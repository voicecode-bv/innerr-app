<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_api_user_id_unique');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->uuid('api_user_id')->nullable(false)->change();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unique('api_user_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_api_user_id_unique');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('api_user_id')->default(0)->nullable(false)->change();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unique('api_user_id');
        });
    }
};
