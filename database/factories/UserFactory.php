<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected $model = User::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'api_user_id' => $this->faker->unique()->uuid(),
            'name' => $this->faker->name(),
            'username' => $this->faker->unique()->userName(),
            'email' => $this->faker->unique()->safeEmail(),
            'avatar' => null,
            'bio' => null,
            'locale' => 'en',
            'password' => 'api-managed',
            'onboarded_at' => now(),
        ];
    }
}
