<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Protege rutas exclusivas del SuperAdministrador global.
 * Registrar en bootstrap/app.php como alias 'superadmin'.
 */
class IsSuperAdmin
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

        if ($user->role !== 'administrador') {
            abort(403, 'Acceso restringido al SuperAdministrador.');
        }

        // Administrador único: debe coincidir con el correo raíz configurado
        if ($user->email !== config('upta.root_admin_email')) {
            abort(403, 'Solo la cuenta raíz puede acceder a este módulo.');
        }

        return $next($request);
    }
}
