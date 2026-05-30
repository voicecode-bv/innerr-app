<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Mirror of the API's user.feed_layout preference ('list'|'masonry').
            // Nullable means the user has not chosen yet; the SPA defaults to
            // masonry and shows a one-time chooser.
            $table->string('feed_layout', 10)->nullable()->after('locale');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('feed_layout');
        });
    }
};
