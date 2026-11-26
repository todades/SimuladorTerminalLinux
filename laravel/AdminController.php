<?php

namespace App\Http\Controllers;

use App\Models\Section;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Panel del SuperAdministrador.
 * Rutas protegidas por el middleware 'superadmin'.
 */
class AdminController extends Controller
{
    /**
     * GET /admin/dashboard
     * Métricas globales en tiempo real + matriz Docente→Estudiantes.
     */
    public function dashboard(Request $request): JsonResponse
    {
        return response()->json([
            'metrics'     => $this->globalMetrics(),
            'matrix'      => $this->assignmentMatrix($request->query('trayecto')),
            'unassigned'  => $this->unassignedStudents(),
            'god_mode'    => (bool) session('god_mode', false),
        ]);
    }

    /**
     * Contadores globales. Una sola consulta agregada por rol
     * para evitar N+1 en instalaciones con miles de usuarios.
     */
    private function globalMetrics(): array
    {
        $counts = User::query()
            ->selectRaw('role, COUNT(*) AS total, SUM(active) AS activos')
            ->groupBy('role')
            ->pluck('total', 'role');

        $activeToday = User::query()
            ->where('last_login_at', '>=', now()->subDay())
            ->count();

        $onlineNow = DB::table('command_logs')
            ->where('executed_at', '>=', now()->subMinutes(5))
            ->distinct('user_id')
            ->count('user_id');

        $byTrayecto = Section::query()
            ->selectRaw('sections.trayecto')
            ->selectRaw('COUNT(DISTINCT sections.teacher_id) AS docentes')
            ->selectRaw('COUNT(DISTINCT users.id) AS estudiantes')
            ->leftJoin('users', function ($join) {
                $join->on('users.section_id', '=', 'sections.id')
                     ->where('users.role', '=', 'estudiante');
            })
            ->groupBy('sections.trayecto')
            ->orderBy('sections.trayecto')
            ->get();

        return [
            'total_teachers'      => (int) ($counts['profesor'] ?? 0),
            'total_students'      => (int) ($counts['estudiante'] ?? 0),
            'active_today'        => $activeToday,
            'online_now'          => $onlineNow,
            'unassigned_students' => User::where('role', 'estudiante')
                                         ->whereNull('teacher_id')->count(),
            'inactive_accounts'   => User::where('active', false)->count(),
            'by_trayecto'         => $byTrayecto,
        ];
    }

    /**
     * Matriz jerárquica: cada Docente con su conteo y lista de estudiantes.
     * withCount evita cargar relaciones completas en el listado inicial.
     */
    private function assignmentMatrix(?string $trayecto = null): array
    {
        return User::query()
            ->where('role', 'profesor')
            ->when($trayecto, fn ($q) => $q->whereHas(
                'sections',
                fn ($s) => $s->where('trayecto', $trayecto)
            ))
            ->withCount([
                'students',
                'students as active_students_count' => fn ($q) => $q->where('active', true),
            ])
            ->with([
                'sections:id,teacher_id,nombre,trayecto,codigo',
                'students' => fn ($q) => $q
                    ->select('id', 'teacher_id', 'nombre', 'apellido', 'email',
                             'cedula', 'active', 'selected_mascot', 'last_login_at')
                    ->with('progress:id,user_id,progress_percent,current_level')
                    ->orderBy('nombre'),
            ])
            ->orderBy('nombre')
            ->get()
            ->map(fn (User $t) => [
                'teacher' => [
                    'id'       => $t->id,
                    'nombre'   => "{$t->nombre} {$t->apellido}",
                    'email'    => $t->email,
                    'cedula'   => $t->cedula,
                    'active'   => $t->active,
                    'trayecto' => $t->sections->first()?->trayecto,
                    'mascot'   => $t->selected_mascot,
                ],
                'students_count'        => $t->students_count,
                'active_students_count' => $t->active_students_count,
                'students'              => $t->students->map(fn (User $s) => [
                    'id'       => $s->id,
                    'nombre'   => "{$s->nombre} {$s->apellido}",
                    'email'    => $s->email,
                    'cedula'   => $s->cedula,
                    'active'   => $s->active,
                    'mascot'   => $s->selected_mascot,
                    'progress' => $s->progress?->progress_percent ?? 0,
                    'level'    => $s->progress?->current_level ?? 1,
                    'online'   => $s->last_login_at?->gt(now()->subDay()) ?? false,
                ]),
            ])
            ->toArray();
    }

    private function unassignedStudents(): array
    {
        return User::where('role', 'estudiante')
            ->whereNull('teacher_id')
            ->select('id', 'nombre', 'apellido', 'email', 'cedula', 'active')
            ->orderBy('nombre')
            ->get()
            ->toArray();
    }

    /**
     * PATCH /admin/students/{student}/assign
     * Reasigna un estudiante a otro Docente titular.
     */
    public function assignTeacher(Request $request, User $student): JsonResponse
    {
        $data = $request->validate([
            'teacher_id' => ['nullable', 'exists:users,id'],
        ]);

        if ($student->role !== 'estudiante') {
            return response()->json(
                ['message' => 'Solo los estudiantes admiten docente titular.'], 422
            );
        }

        if ($data['teacher_id'] ?? null) {
            $teacher = User::findOrFail($data['teacher_id']);
            if ($teacher->role !== 'profesor') {
                return response()->json(
                    ['message' => 'El usuario indicado no es docente.'], 422
                );
            }
            $section = $teacher->sections()->where('active', true)->first();
            $student->update([
                'teacher_id' => $teacher->id,
                'section_id' => $section?->id,
            ]);
        } else {
            $student->update(['teacher_id' => null, 'section_id' => null]);
        }

        return response()->json([
            'message' => 'Asignación actualizada.',
            'student' => $student->fresh(['teacher', 'section']),
        ]);
    }

    /**
     * PATCH /admin/users/{user}/role
     * Alterna entre estudiante y profesor. El rol de administrador es exclusivo.
     */
    public function changeRole(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'role' => ['required', 'in:estudiante,profesor'],
        ]);

        if ($user->email === config('upta.root_admin_email')) {
            return response()->json(
                ['message' => 'El administrador raíz no puede cambiar de rol.'], 403
            );
        }

        // Al degradar un docente, sus estudiantes quedan sin titular
        if ($user->role === 'profesor' && $data['role'] === 'estudiante') {
            User::where('teacher_id', $user->id)
                ->update(['teacher_id' => null, 'section_id' => null]);
        }

        $user->update(['role' => $data['role']]);

        return response()->json(['message' => 'Rol actualizado.', 'user' => $user]);
    }

    /**
     * PATCH /admin/users/{user}/toggle
     * Activa o desactiva una cuenta.
     * Con ?cascade=1 arrastra a los estudiantes del docente.
     */
    public function toggleActive(Request $request, User $user): JsonResponse
    {
        if ($user->email === config('upta.root_admin_email')) {
            return response()->json(
                ['message' => 'La cuenta del administrador no puede desactivarse.'], 403
            );
        }

        $newState = !$user->active;
        $cascade  = $request->boolean('cascade') && $user->role === 'profesor';

        DB::transaction(function () use ($user, $newState, $cascade) {
            $user->update(['active' => $newState]);
            if ($cascade) {
                User::where('teacher_id', $user->id)
                    ->where('role', 'estudiante')
                    ->update(['active' => $newState]);
            }
        });

        return response()->json([
            'message' => $newState ? 'Cuenta activada.' : 'Cuenta desactivada.',
            'active'  => $newState,
            'cascaded' => $cascade,
        ]);
    }

    /**
     * GET /admin/users/{user}/deletion-impact
     * Previsualiza qué se perderá antes de confirmar.
     */
    public function deletionImpact(User $user): JsonResponse
    {
        if ($user->email === config('upta.root_admin_email')) {
            return response()->json([
                'can_delete' => false,
                'reason'     => 'La cuenta del administrador no puede eliminarse.',
            ], 403);
        }

        $isTeacher = $user->role === 'profesor';

        return response()->json([
            'can_delete'        => true,
            'is_teacher'        => $isTeacher,
            'orphaned_students' => $isTeacher
                ? User::where('teacher_id', $user->id)->count() : 0,
            'command_logs'      => $user->commandLogs()->count(),
            'lab_sessions'      => $user->labSessions()->count(),
            'messages'          => DB::table('messages')
                ->where('to_user_id', $user->id)
                ->orWhere('from_user_id', $user->id)
                ->count(),
        ]);
    }

    /**
     * DELETE /admin/users/{user}
     * Elimina la cuenta y purga sus datos derivados.
     * Los estudiantes de un docente eliminado quedan sin titular.
     */
    public function destroy(User $user): JsonResponse
    {
        if ($user->email === config('upta.root_admin_email')) {
            return response()->json(
                ['message' => 'La cuenta del administrador no puede eliminarse.'], 403
            );
        }

        $name    = "{$user->nombre} {$user->apellido}";
        $orphans = 0;

        DB::transaction(function () use ($user, &$orphans) {
            // Cascada: liberar estudiantes y cerrar secciones
            if ($user->role === 'profesor') {
                $orphans = User::where('teacher_id', $user->id)
                    ->update(['teacher_id' => null, 'section_id' => null]);
                Section::where('teacher_id', $user->id)
                    ->update(['active' => false, 'teacher_id' => null]);
            }

            // Purga de datos derivados
            $user->progress()?->delete();
            $user->commandLogs()->delete();
            $user->labSessions()->delete();

            DB::table('messages')
                ->where('to_user_id', $user->id)
                ->orWhere('from_user_id', $user->id)
                ->delete();

            DB::table('notifications')
                ->where('target_user_id', $user->id)
                ->orWhere('related_user_id', $user->id)
                ->delete();

            $user->forceDelete();
        });

        return response()->json([
            'message'  => "{$name} fue eliminado junto con todos sus datos.",
            'orphaned' => $orphans,
        ]);
    }

    /**
     * PATCH /admin/users/bulk-toggle
     * Activa o desactiva varias cuentas de una vez.
     */
    public function bulkToggle(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids'    => ['required', 'array', 'min:1'],
            'ids.*'  => ['integer', 'exists:users,id'],
            'active' => ['required', 'boolean'],
        ]);

        $affected = User::whereIn('id', $data['ids'])
            ->where('email', '!=', config('upta.root_admin_email'))
            ->update(['active' => $data['active']]);

        return response()->json([
            'message'  => "{$affected} cuenta(s) actualizadas.",
            'affected' => $affected,
        ]);
    }

    /**
     * POST /admin/god-mode
     * Alterna el Modo Dios Total (desbloquea toda la malla curricular).
     */
    public function toggleGodMode(Request $request): JsonResponse
    {
        $enabled = !session('god_mode', false);
        session(['god_mode' => $enabled]);

        return response()->json([
            'god_mode' => $enabled,
            'message'  => $enabled
                ? 'Modo Dios Total activado: todos los niveles desbloqueados.'
                : 'Modo Dios Total desactivado.',
        ]);
    }

    /**
     * POST /admin/impersonate/{user}
     * Suplanta a un Docente o Estudiante para dar soporte.
     */
    public function impersonate(Request $request, User $user): JsonResponse
    {
        if ($user->email === config('upta.root_admin_email')) {
            return response()->json(
                ['message' => 'No puedes suplantar la cuenta de administrador.'], 403
            );
        }

        session(['impersonator_id' => $request->user()->id]);
        auth()->login($user);
        $request->session()->regenerate();

        return response()->json([
            'message'  => "Ahora ves la plataforma como {$user->nombre} {$user->apellido}.",
            'redirect' => $user->role === 'profesor'
                ? route('teacher.dashboard')
                : route('dashboard'),
        ]);
    }

    /**
     * POST /admin/stop-impersonating
     * Restaura la sesión original del SuperAdministrador.
     */
    public function stopImpersonating(Request $request): JsonResponse
    {
        $originalId = session('impersonator_id');

        if (!$originalId) {
            return response()->json(['message' => 'No hay suplantación activa.'], 400);
        }

        auth()->loginUsingId($originalId);
        session()->forget('impersonator_id');
        $request->session()->regenerate();

        return response()->json([
            'message'  => 'Sesión restaurada.',
            'redirect' => route('admin.dashboard'),
        ]);
    }
}
