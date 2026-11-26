<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Garantiza que un Docente solo manipule estudiantes de SU sección.
 * El SuperAdministrador queda exento (acceso global).
 *
 * Uso: Route::patch('/students/{student}', ...)->middleware('owns.student');
 */
class EnsureOwnsStudent
{
    public function handle(Request $request, Closure $next): Response
    {
        $actor = $request->user();
        $student = $request->route('student');

        if (!$student instanceof User) {
            $student = User::find($student);
        }

        if (!$student) {
            abort(404, 'Estudiante no encontrado.');
        }

        // El SuperAdmin tiene visibilidad total
        if ($actor->role === 'administrador') {
            return $next($request);
        }

        // El Docente solo accede a sus propios estudiantes
        if ($student->teacher_id !== $actor->id) {
            abort(403, 'Este estudiante no pertenece a tu sección.');
        }

        return $next($request);
    }
}
