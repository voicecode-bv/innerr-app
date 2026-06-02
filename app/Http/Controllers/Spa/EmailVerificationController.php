<?php

namespace App\Http\Controllers\Spa;

use App\Http\Controllers\Auth\Concerns\HandlesAuthenticatedSession;
use App\Http\Controllers\Controller;
use App\Services\ApiClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class EmailVerificationController extends Controller
{
    use HandlesAuthenticatedSession;

    public function __construct(protected ApiClient $apiClient) {}

    public function verify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string'],
        ]);

        $result = $this->apiClient->verifyEmail($validated['code']);

        if (! $result['success']) {
            if (! empty($result['errors'])) {
                throw ValidationException::withMessages($result['errors']);
            }

            throw ValidationException::withMessages([
                'code' => $result['message'] ?? __('Invalid verification code'),
            ]);
        }

        // Mirror the now-verified user into the local session store so the SPA
        // sees email_verified immediately and the router gate releases.
        $this->syncLocalUser($result['user']);

        return response()->json([
            'user' => $this->presentUser(Auth::user()),
        ]);
    }

    public function resend(): JsonResponse
    {
        $result = $this->apiClient->resendEmailVerification();

        if (! $result['success']) {
            $response = response()->json([
                'message' => $result['message'] ?? __('Could not resend verification code'),
                'retry_after' => $result['retry_after'] ?? null,
            ], $result['status'] ?? 422);

            // Expose the wait as a Retry-After header too; the SPA http client
            // reads the cooldown from there.
            if (! empty($result['retry_after'])) {
                $response->header('Retry-After', (string) $result['retry_after']);
            }

            return $response;
        }

        return response()->json([
            'message' => $result['message'] ?? __('A new verification code has been sent'),
        ]);
    }
}
