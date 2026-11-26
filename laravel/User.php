<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'nombre', 'apellido', 'email', 'cedula', 'telefono', 'genero',
        'password', 'role', 'active', 'section_id', 'teacher_id',
        'selected_mascot', 'mascot_gender', 'last_login_at',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'password'      => 'hashed',
            'active'        => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    // ═══ Relaciones de jerarquía ══════════════════════

    /** Docente titular de este estudiante (inversa 1-a-Muchos) */
    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    /** Estudiantes a cargo de este docente */
    public function students(): HasMany
    {
        return $this->hasMany(User::class, 'teacher_id')
                    ->where('role', 'estudiante');
    }

    /** Sección a la que pertenece el estudiante */
    public function section(): BelongsTo
    {
        return $this->belongsTo(Section::class);
    }

    /** Secciones que imparte el docente */
    public function sections(): HasMany
    {
        return $this->hasMany(Section::class, 'teacher_id');
    }

    public function progress(): HasOne
    {
        return $this->hasOne(UserProgress::class);
    }

    public function commandLogs(): HasMany
    {
        return $this->hasMany(CommandLog::class);
    }

    public function labSessions(): HasMany
    {
        return $this->hasMany(LabSession::class);
    }

    // ═══ Scopes ═══════════════════════════════════════

    public function scopeStudents($q) { return $q->where('role', 'estudiante'); }
    public function scopeTeachers($q) { return $q->where('role', 'profesor'); }
    public function scopeActive($q)   { return $q->where('active', true); }

    public function scopeActiveToday($q)
    {
        return $q->where('last_login_at', '>=', now()->subDay());
    }

    // ═══ Helpers de rol ═══════════════════════════════

    public function isStudent(): bool    { return $this->role === 'estudiante'; }
    public function isTeacher(): bool    { return $this->role === 'profesor'; }
    public function isSuperAdmin(): bool { return $this->role === 'administrador'; }

    /** Modo Dios: docentes y superadmin ven todo desbloqueado */
    public function canUnlockAllLevels(): bool
    {
        return in_array($this->role, ['profesor', 'administrador'], true);
    }

    public function getFullNameAttribute(): string
    {
        return "{$this->nombre} {$this->apellido}";
    }
}
