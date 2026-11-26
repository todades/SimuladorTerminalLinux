<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserProgress extends Model
{
    protected $fillable = [
        'user_id',
        'completed_steps',
        'progress_percent',
        'current_level',
    ];

    protected function casts(): array
    {
        return [
            'completed_steps' => 'string', // JSON string
            'progress_percent' => 'integer',
            'current_level' => 'integer',
        ];
    }

    /**
     * Relación inversa con el usuario.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
