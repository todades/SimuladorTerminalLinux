<?php

namespace App\Http\Controllers;

use App\Models\UserProgress;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ProgressController extends Controller
{
    /**
     * GET /api/progress
     * Carga el estado guardado del progreso del estudiante.
     */
    public function index()
    {
        $progress = UserProgress::where('user_id', Auth::id())->first();

        if (!$progress) {
            $progress = UserProgress::create([
                'user_id'         => Auth::id(),
                'completed_steps'  => json_encode([]),
                'progress_percent' => 0,
                'current_level'    => 1,
            ]);
        }

        return response()->json([
            'completed_steps'  => json_decode($progress->completed_steps, true) ?? [],
            'progress_percent' => $progress->progress_percent,
            'current_level'    => $progress->current_level,
        ]);
    }

    /**
     * POST /api/progress/update
     * Recibe { step_id } y actualiza el progreso.
     */
    public function update(Request $request)
    {
        $validated = $request->validate([
            'step_id' => ['required', 'string'],
        ]);

        $progress = UserProgress::where('user_id', Auth::id())->firstOrFail();
        $steps = json_decode($progress->completed_steps, true) ?? [];

        if (!in_array($validated['step_id'], $steps, true)) {
            $steps[] = $validated['step_id'];
            $progress->completed_steps = json_encode($steps);
        }

        // Calcular porcentaje (asumiendo 21 pasos totales: 8 N1 + 7 N2 + 6 N3)
        $totalSteps = 21;
        $progress->progress_percent = min(100, (int) round((count($steps) / $totalSteps) * 100));

        // Determinar nivel actual
        if (count($steps) >= 15) {
            $progress->current_level = 3;
        } elseif (count($steps) >= 8) {
            $progress->current_level = 2;
        }

        $progress->save();

        return response()->json([
            'completed_steps'  => $steps,
            'progress_percent' => $progress->progress_percent,
            'current_level'    => $progress->current_level,
        ]);
    }

    /**
     * POST /api/progress/reset
     * Restablece el progreso del estudiante a 0%.
     */
    public function reset()
    {
        $progress = UserProgress::where('user_id', Auth::id())->firstOrFail();
        $progress->update([
            'completed_steps'  => json_encode([]),
            'progress_percent' => 0,
            'current_level'    => 1,
        ]);

        return response()->json([
            'message'          => 'Progreso reiniciado correctamente.',
            'completed_steps'  => [],
            'progress_percent' => 0,
            'current_level'    => 1,
        ]);
    }
}
