<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Models\Section;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

/**
 * Flujo de solicitud y autorización de cuentas docentes.
 *
 * Registro  → POST /register (público)   → estado 'pending' + notificación
 * Revisión  → /admin/* (middleware superadmin)
 */
class TeacherApprovalController extends Controller
{
    /**
     * POST /register
     * El rol solicitado define el flujo: estudiante entra directo,
     * docente queda pendiente de autorización.
     */
    public function register(Request $request): JsonResponse
    {
        $isTeacher = $request->input('requested_role') === 'profesor';

        $rules = [
            'nombre'   => ['required', 'string', 'max:60', 'regex:/^[\pL\s]+$/u'],
            'apellido' => ['required', 'string', 'max:60', 'regex:/^[\pL\s]+$/u'],
            'email'    => ['required', 'email', 'unique:users,email',
                           'regex:/^[a-zA-Z0-9._%+\-]+@gmail\.com$/'],
            'cedula'   => ['required', 'digits:8', 'unique:users,cedula'],
            // Prefijos de operadora permitidos: 0412 · 0422 · 0416 · 0424
            'telefono' => ['required', 'regex:/^(0412|0422|0416|0424)\d{7}$/',
                           'unique:users,telefono'],
            'genero'   => ['required', 'in:masculino,femenino'],
            'password' => ['required', 'confirmed',
                           Password::min(12)->mixedCase()->numbers()->symbols()],
            'requested_role'  => ['nullable', 'in:estudiante,profesor'],
            'selected_mascot' => ['required', 'in:pinguino,zorro,buho,dragon'],
            'mascot_gender'   => ['required', 'in:masculino,femenino'],
        ];

        // El Trayecto y el docente titular SOLO aplican a estudiantes
        if (!$isTeacher) {
            $rules['trayecto']   = ['required', 'in:Trayecto I,Trayecto II,Trayecto III,Trayecto IV'];
            $rules['teacher_id'] = ['nullable', 'exists:users,id'];
        }

        $data = $request->validate($rules, [
            'cedula.digits'   => 'La cédula debe tener exactamente 8 dígitos.',
            'telefono.regex'  => 'El teléfono debe tener 11 dígitos con prefijo 0412, 0422, 0416 o 0424. Ejemplo: 04120000000',
            'email.regex'     => 'El correo debe ser una cuenta Gmail válida.',
            'password.min'    => 'La contraseña debe tener al menos 12 caracteres.',
        ]);

        $user = DB::transaction(function () use ($data, $isTeacher) {
            $user = User::create([
                'nombre'          => $data['nombre'],
                'apellido'        => $data['apellido'],
                'email'           => $data['email'],
                'cedula'          => $data['cedula'],
                'telefono'        => $data['telefono'],
                'genero'          => $data['genero'],
                'password'        => Hash::make($data['password']),
                'role'            => $isTeacher ? 'profesor' : 'estudiante',
                // Docente: sin Trayecto ni acceso hasta ser aprobado
                'trayecto'        => $isTeacher ? null : $data['trayecto'],
                'teacher_id'      => $isTeacher ? null : ($data['teacher_id'] ?? null),
                'active'          => !$isTeacher,
                'approval_status' => $isTeacher ? 'pending' : 'approved',
                'selected_mascot' => $data['selected_mascot'],
                'mascot_gender'   => $data['mascot_gender'],
            ]);

            if (!$isTeacher) {
                $user->progress()->create([
                    'completed_steps'  => json_encode([]),
                    'progress_percent' => 0,
                    'current_level'    => 1,
                ]);
            }

            return $user;
        });

        // Notificar al SuperAdministrador
        if ($isTeacher) {
            $admin = User::where('email', config('upta.root_admin_email'))->first();

            if ($admin) {
                Notification::create([
                    'type'            => 'teacher_request',
                    'title'           => 'Nueva solicitud de cuenta docente',
                    'body'            => "{$user->nombre} {$user->apellido} (C.I. {$user->cedula}) solicita acceso como docente.",
                    'target_user_id'  => $admin->id,
                    'related_user_id' => $user->id,
                ]);

                // Opcional: correo al administrador
                // Mail::to($admin->email)->queue(new TeacherRequestMail($user));
            }

            return response()->json([
                'status'  => 'pending',
                'message' => 'Solicitud enviada. Tu cuenta docente está pendiente de autorización.',
            ], 202);
        }

        auth()->login($user);
        $request->session()->regenerate();

        return response()->json([
            'status'   => 'approved',
            'redirect' => route('dashboard'),
        ], 201);
    }

    /**
     * GET /admin/pending-teachers
     * Bandeja de solicitudes pendientes del SuperAdmin.
     */
    public function pending(): JsonResponse
    {
        return response()->json([
            'pending' => User::where('role', 'profesor')
                ->where('approval_status', 'pending')
                ->select('id', 'nombre', 'apellido', 'email', 'cedula',
                         'telefono', 'selected_mascot', 'created_at')
                ->orderBy('created_at')
                ->get(),
            'count' => User::where('role', 'profesor')
                ->where('approval_status', 'pending')->count(),
        ]);
    }

    /**
     * PATCH /admin/teachers/{user}/approve
     * Autoriza la cuenta y le asigna el Trayecto/sección.
     */
    public function approve(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'trayecto' => ['required', 'in:Trayecto I,Trayecto II,Trayecto III,Trayecto IV'],
        ]);

        if ($user->role !== 'profesor' || $user->approval_status !== 'pending') {
            return response()->json(
                ['message' => 'Esta cuenta no tiene una solicitud pendiente.'], 422
            );
        }

        DB::transaction(function () use ($user, $data, $request) {
            $user->update([
                'approval_status'  => 'approved',
                'active'           => true,
                'trayecto'         => $data['trayecto'],
                'reviewed_by'      => $request->user()->id,
                'reviewed_at'      => now(),
                'rejection_reason' => null,
            ]);

            // Crear (o reutilizar) la sección del docente
            Section::firstOrCreate(
                ['teacher_id' => $user->id, 'trayecto' => $data['trayecto']],
                [
                    'nombre'  => "{$data['trayecto']} — Prof. {$user->apellido}",
                    'codigo'  => strtoupper(substr(md5($user->id . $data['trayecto']), 0, 12)),
                    'periodo' => config('upta.periodo_actual', '2026-I'),
                    'active'  => true,
                ]
            );

            Notification::create([
                'type'            => 'teacher_approved',
                'title'           => '✅ Cuenta docente autorizada',
                'body'            => "Tu solicitud fue aprobada. Se te asignó {$data['trayecto']}.",
                'target_user_id'  => $user->id,
                'related_user_id' => $user->id,
            ]);
        });

        return response()->json([
            'message' => "Docente autorizado y asignado a {$data['trayecto']}.",
            'user'    => $user->fresh('sections'),
        ]);
    }

    /**
     * PATCH /admin/teachers/{user}/reject
     */
    public function reject(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:200'],
        ]);

        $reason = $data['reason'] ?? 'No se indicó un motivo.';

        DB::transaction(function () use ($user, $reason, $request) {
            $user->update([
                'approval_status'  => 'rejected',
                'active'           => false,
                'reviewed_by'      => $request->user()->id,
                'reviewed_at'      => now(),
                'rejection_reason' => $reason,
            ]);

            Notification::create([
                'type'            => 'teacher_rejected',
                'title'           => '❌ Solicitud docente rechazada',
                'body'            => "Tu solicitud no fue aprobada. Motivo: {$reason}",
                'target_user_id'  => $user->id,
                'related_user_id' => $user->id,
            ]);
        });

        return response()->json(['message' => 'Solicitud rechazada.']);
    }
}
