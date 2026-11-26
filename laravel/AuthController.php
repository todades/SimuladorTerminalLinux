<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Registrar un nuevo estudiante con validación estricta.
     * Redirige directamente al simulador (/simulator) al completar.
     */
    public function register(Request $request)
    {
        $validated = $request->validate([
            'nombre'          => ['required', 'string', 'max:60', 'regex:/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/'],
            'apellido'        => ['required', 'string', 'max:60', 'regex:/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/'],
            'email'           => ['required', 'email', 'unique:users,email'],
            'cedula'          => ['required', 'string', 'regex:/^\d{8}$/', 'unique:users,cedula'],
            'trayecto'        => ['required', 'string', 'in:Trayecto I,Trayecto II,Trayecto III,Trayecto IV'],
            'genero'          => ['required', 'string', 'in:masculino,femenino'],
            'telefono'        => ['required', 'string',
                                  'regex:/^(0412|0422|0416|0424)\d{7}$/',
                                  'unique:users,telefono'],
            'password'        => [
                'required',
                'confirmed',
                Password::min(12)
                    ->mixedCase()
                    ->numbers()
                    ->symbols(),
            ],
            'mascot_species'  => ['required', 'string', 'in:pinguino,zorro,buho,dragon'],
            'mascot_gender'   => ['required', 'string', 'in:masculino,femenino'],
        ], [
            'password.min'             => 'La contraseña debe tener al menos 12 caracteres.',
            'telefono.regex'           => 'El teléfono debe tener 11 dígitos con prefijo 0412, 0422, 0416 o 0424. Ejemplo: 04120000000',
            'cedula.regex'             => 'La cédula debe tener exactamente 8 dígitos numéricos.',
            'nombre.regex'             => 'El nombre solo puede contener letras y espacios.',
            'apellido.regex'           => 'El apellido solo puede contener letras y espacios.',
        ]);

        $user = User::create([
            'nombre'          => $validated['nombre'],
            'apellido'        => $validated['apellido'],
            'email'           => $validated['email'],
            'cedula'          => $validated['cedula'],
            'trayecto'        => $validated['trayecto'],
            'genero'          => $validated['genero'],
            'telefono'        => $validated['telefono'],
            'password'        => Hash::make($validated['password']),
            'selected_mascot' => $validated['mascot_species'],
            'mascot_gender'   => $validated['mascot_gender'],
        ]);

        // Crear registro de progreso inicial
        $user->progress()->create([
            'completed_steps'  => json_encode([]),
            'progress_percent' => 0,
            'current_level'    => 1,
        ]);

        auth()->login($user);
        $request->session()->regenerate();

        // Redirección al panel del estudiante
        return redirect('/dashboard')->with('success', '¡Bienvenido al Terminal Lab!');
    }

    /**
     * Iniciar sesión con rate limiting (5 intentos/minuto).
     * Redirige directamente al simulador (/simulator) al autenticar.
     */
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        // Rate limiting: 5 intentos por minuto por IP
        $key = 'login:' . $request->ip();
        if (RateLimiter::tooManyAttempts($key, 5)) {
            $seconds = RateLimiter::availableIn($key);
            throw ValidationException::withMessages([
                'email' => "Demasiados intentos. Intenta de nuevo en {$seconds} segundos.",
            ]);
        }

        if (!auth()->attempt($credentials, $request->boolean('remember'))) {
            RateLimiter::hit($key, 60);
            throw ValidationException::withMessages([
                'email' => 'Las credenciales proporcionadas no son correctas.',
            ]);
        }

        RateLimiter::clear($key);
        $request->session()->regenerate();

        // Redirección al panel del estudiante
        return redirect('/dashboard')->with('success', '¡Bienvenido de vuelta!');
    }

    /**
     * Cerrar sesión de forma segura.
     */
    public function logout(Request $request)
    {
        auth()->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/')->with('success', 'Sesión cerrada correctamente.');
    }
}
