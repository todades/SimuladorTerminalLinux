<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sección = Trayecto impartido por un Docente.
 * Un Docente puede tener varias secciones; cada Estudiante pertenece a una.
 *
 * Debe ejecutarse ANTES de create_users_table (por la FK section_id).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sections', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 80);                     // "Trayecto II — Sección A"
            $table->enum('trayecto', [
                'Trayecto I', 'Trayecto II', 'Trayecto III', 'Trayecto IV',
            ]);
            $table->char('codigo', 12)->unique();             // "T2-A-2026"
            $table->string('periodo', 20)->default('2026-I'); // período académico

            // Docente titular — se asigna tras crear users (nullable + FK diferida)
            $table->unsignedBigInteger('teacher_id')->nullable();

            $table->unsignedSmallInteger('cupo_maximo')->default(40);
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->index(['trayecto', 'active']);
            $table->index('teacher_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sections');
    }
};
