<?php

use Illuminate\Support\Facades\Schedule;

// Schedule::command('sync:device-info')->daily()->onAnyNetwork();

Schedule::command('posts:gc-upload-sessions')->hourly();
