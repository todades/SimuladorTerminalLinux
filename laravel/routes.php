<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ProgressController;
use App\Http\Controllers\TeacherApprovalController;
use App\Http\Controllers\TeacherController;
use Illuminate\Support\Facades\Route;

// ═══════════════════════════════════════════════════════
// RUTAS PÚBLICAS
// ═══════════════════════════════════════════════════════

Route::get('/', fn () => view('auth.login'))->name('login');

Route::post('/login', [AuthController::class, 'login'])
    ->middleware('throttle:5,1')
    ->name('login.submit');

/**
 * Registro unificado: `requested_role` decide el flujo.
 *  - estudiante → activo de inmediato
 *  - profesor   → approval_status 'pending' + notifica al SuperAdmin
 */
Route::post('/register', [TeacherApprovalController::class, 'register'])
    ->middleware('throttle:3,1')
    ->name('register.submit');

/** Docentes disponibles por Trayecto — alimenta el <select> del registro */
Route::get('/api/teachers/{trayecto}', [AuthController::class, 'teachersByTrayecto'])
    ->name('teachers.by-trayecto');

// ═══════════════════════════════════════════════════════
// AUTENTICADO (cualquier rol)
// ═══════════════════════════════════════════════════════

Route::middleware(['auth', 'active'])->group(function () {

    Route::get('/dashboard',  fn () => view('dashboard'))->name('dashboard');
    Route::get('/simulator',  fn () => view('simulator'))->name('simulator');
    Route::get('/lecciones',  fn () => view('lecciones'))->name('lecciones');
    Route::get('/perfil',     fn () => view('perfil'))->name('perfil');
    Route::post('/logout',    [AuthController::class, 'logout'])->name('logout');

    // Progreso propio
    Route::get('/api/progress',         [ProgressController::class, 'index']);
    Route::post('/api/progress/update', [ProgressController::class, 'update']);
    Route::post('/api/progress/reset',  [ProgressController::class, 'reset']);

    // Bandeja del estudiante
    Route::get('/mensajes',                   [TeacherController::class, 'inbox'])->name('inbox');
    Route::patch('/api/messages/{message}/read', [TeacherController::class, 'markRead']);
});

// ═══════════════════════════════════════════════════════
// DOCENTE — Administrador de Sección
// ═══════════════════════════════════════════════════════

Route::middleware(['auth', 'active', 'teacher'])->prefix('docente')->group(function () {

    Route::get('/dashboard', [TeacherController::class, 'dashboard'])
        ->name('teacher.dashboard');

    /** Métricas de los estudiantes de SU sección */
    Route::get('/api/students', [TeacherController::class, 'myStudents']);

    /** Detalle e historial — protegido por propiedad del estudiante */
    Route::get('/api/students/{student}', [TeacherController::class, 'studentDetail'])
        ->middleware('owns.student');

    /** Mensajería docente → estudiante */
    Route::post('/api/students/{student}/message', [TeacherController::class, 'sendMessage'])
        ->middleware('owns.student');

    /** Modo Dios del docente: desbloquea su Trayecto */
    Route::post('/api/god-mode', [TeacherController::class, 'toggleGodMode']);
});

// ═══════════════════════════════════════════════════════
// SUPERADMIN — Control Global
// ═══════════════════════════════════════════════════════

Route::middleware(['auth', 'active', 'superadmin'])->prefix('admin')->group(function () {

    Route::get('/dashboard', [AdminController::class, 'dashboard'])
        ->name('admin.dashboard');

    /** Autorización de cuentas docentes */
    Route::get('/pending-teachers',          [TeacherApprovalController::class, 'pending']);
    Route::patch('/teachers/{user}/approve', [TeacherApprovalController::class, 'approve']);
    Route::patch('/teachers/{user}/reject',  [TeacherApprovalController::class, 'reject']);

    /** Matriz de relaciones y reasignación */
    Route::patch('/students/{student}/assign', [AdminController::class, 'assignTeacher']);

    /** Gestión de usuarios */
    Route::patch('/users/{user}/role',   [AdminController::class, 'changeRole']);
    Route::patch('/users/{user}/toggle', [AdminController::class, 'toggleActive']);
    Route::patch('/users/bulk-toggle',   [AdminController::class, 'bulkToggle']);

    /** Eliminación: primero se consulta el impacto, luego se confirma */
    Route::get('/users/{user}/deletion-impact', [AdminController::class, 'deletionImpact']);
    Route::delete('/users/{user}',              [AdminController::class, 'destroy']);

    /** Modo Dios Total */
    Route::post('/god-mode', [AdminController::class, 'toggleGodMode']);

    /** Suplantación para soporte */
    Route::post('/impersonate/{user}',  [AdminController::class, 'impersonate']);
    Route::post('/stop-impersonating',  [AdminController::class, 'stopImpersonating']);
});
