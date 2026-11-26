<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();

            // ─── Datos personales ───────────────────────
            $table->string('nombre', 60);
            $table->string('apellido', 60);
            $table->string('email')->unique();          // solo @gmail.com
            $table->char('cedula', 8)->unique();        // exactamente 8 dígitos
            $table->char('telefono', 11);               // 04XXXXXXXXX
            $table->enum('genero', ['masculino', 'femenino']);
            $table->string('password');                 // Argon2id

            // ─── RBAC: jerarquía de 3 niveles ───────────
            $table->enum('role', ['estudiante', 'profesor', 'administrador'])
                  ->default('estudiante');
            $table->boolean('active')->default(true);

            // ─── Asignación académica ───────────────────
            $table->foreignId('section_id')
                  ->nullable()
                  ->constrained('sections')
                  ->nullOnDelete();

            /**
             * FK directa Docente → Estudiantes (relación 1-a-Muchos).
             * Se mantiene junto a section_id para consultas rápidas
             * sin JOIN cuando solo se necesita el titular.
             */
            $table->foreignId('teacher_id')
                  ->nullable()
                  ->constrained('users')
                  ->nullOnDelete();

            // ─── Personalización ────────────────────────
            $table->enum('selected_mascot', ['pinguino', 'zorro', 'buho', 'dragon'])
                  ->default('pinguino');
            $table->enum('mascot_gender', ['masculino', 'femenino'])
                  ->default('masculino');

            $table->timestamp('last_login_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();

            // ─── Índices para el dashboard del SuperAdmin ──
            $table->index(['role', 'active']);
            $table->index(['teacher_id', 'role']);
            $table->index('section_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
