<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Teléfono móvil venezolano con prefijo de operadora autorizado.
 *
 *   0412 · Digitel
 *   0422 · Digitel
 *   0416 · Movilnet
 *   0424 · Movistar
 *
 * Formato: 11 dígitos sin separadores. Ejemplo: 04120000000
 */
class VenezuelanPhone implements ValidationRule
{
    public const PREFIXES = ['0412', '0422', '0416', '0424'];

    public const OPERATORS = [
        '0412' => 'Digitel',
        '0422' => 'Digitel',
        '0416' => 'Movilnet',
        '0424' => 'Movistar',
    ];

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $phone = preg_replace('/\D/', '', (string) $value);

        if (strlen($phone) !== 11) {
            $fail('El teléfono debe tener exactamente 11 dígitos.');
            return;
        }

        if (!in_array(substr($phone, 0, 4), self::PREFIXES, true)) {
            $fail(sprintf(
                'El prefijo debe ser %s. Ejemplo: 04120000000',
                implode(', ', self::PREFIXES),
            ));
        }
    }

    /** Operadora asociada al número, o null si el prefijo es inválido */
    public static function operator(string $phone): ?string
    {
        return self::OPERATORS[substr(preg_replace('/\D/', '', $phone), 0, 4)] ?? null;
    }
}
