<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Permite el acceso a Docentes y al SuperAdministrador.
 * Alias sugerido: 'teacher'.
 */
class IsTeacher
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return redirect()->route('login');
        }

        if (!$user->active) {
            auth()->logout();
            return redirect()->route('login')
                ->withErrors(['email' => 'Tu cuenta ha sido desactivada.']);
        }

        if (!in_array($user->role, ['profesor', 'administrador'], true)) {
            abort(403, 'Acceso restringido a docentes.');
        }

        return $next($request);
    }
}
