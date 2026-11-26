<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Flujo de autorización de cuentas docentes.
 * Los estudiantes se auto-aprueban; los docentes quedan 'pending'
 * hasta que el SuperAdministrador los autorice y les asigne Trayecto.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('approval_status', ['pending', 'approved', 'rejected'])
                  ->default('approved')
                  ->after('active');

            $table->foreignId('reviewed_by')
                  ->nullable()
                  ->after('approval_status')
                  ->constrained('users')
                  ->nullOnDelete();

            $table->timestamp('reviewed_at')->nullable()->after('reviewed_by');
            $table->string('rejection_reason', 200)->nullable()->after('reviewed_at');

            // El Trayecto pasa a ser nullable: el docente no lo elige al registrarse
            $table->string('trayecto', 20)->nullable()->change();

            $table->index(['role', 'approval_status']);
        });

        // Bandeja de notificaciones del sistema
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->enum('type', [
                'teacher_request', 'teacher_approved', 'teacher_rejected', 'info',
            ]);
            $table->string('title', 120);
            $table->text('body');

            $table->foreignId('target_user_id')
                  ->constrained('users')->cascadeOnDelete();
            $table->foreignId('related_user_id')
                  ->nullable()->constrained('users')->nullOnDelete();

            $table->boolean('read')->default(false);
            $table->timestamps();

            $table->index(['target_user_id', 'read']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['reviewed_by']);
            $table->dropColumn([
                'approval_status', 'reviewed_by', 'reviewed_at', 'rejection_reason',
            ]);
        });
    }
};
