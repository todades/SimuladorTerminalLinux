<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Section extends Model
{
    protected $fillable = [
        'nombre', 'trayecto', 'codigo', 'periodo',
        'teacher_id', 'cupo_maximo', 'active',
    ];

    protected function casts(): array
    {
        return ['active' => 'boolean', 'cupo_maximo' => 'integer'];
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function students(): HasMany
    {
        return $this->hasMany(User::class)->where('role', 'estudiante');
    }

    public function getCuposDisponiblesAttribute(): int
    {
        return max(0, $this->cupo_maximo - $this->students()->count());
    }

    public function scopeByTrayecto($q, string $t)
    {
        return $q->where('trayecto', $t);
    }
}
