<?php

it('serves the SPA shell on the root route', function () {
    $this->get('/')
        ->assertOk()
        ->assertSee('<div id="spa-app"></div>', false);
});

it('serves the SPA shell for unknown routes via the catch-all', function () {
    $this->get('/login')
        ->assertOk()
        ->assertSee('<div id="spa-app"></div>', false);

    $this->get('/register')
        ->assertOk()
        ->assertSee('<div id="spa-app"></div>', false);

    $this->get('/onboarding/intro')
        ->assertOk()
        ->assertSee('<div id="spa-app"></div>', false);

    $this->get('/posts/123')
        ->assertOk()
        ->assertSee('<div id="spa-app"></div>', false);

    $this->get('/circles/42')
        ->assertOk()
        ->assertSee('<div id="spa-app"></div>', false);

    $this->get('/profiles/janedoe')
        ->assertOk()
        ->assertSee('<div id="spa-app"></div>', false);

    $this->get('/settings/persons')
        ->assertOk()
        ->assertSee('<div id="spa-app"></div>', false);

    $this->get('/notifications')
        ->assertOk()
        ->assertSee('<div id="spa-app"></div>', false);
});

it('does not let the SPA catch-all swallow API or proxy paths', function () {
    // Bootstrap should respond as JSON, not HTML.
    $response = $this->get('/api/spa/bootstrap');
    expect($response->headers->get('content-type'))->toContain('application/json');
});

it('inlines the dark-mode bootstrap before Vite assets', function () {
    // The inline script must run before paint to avoid a flash of light
    // content when the user prefers dark. Anchored on the localStorage key
    // shared with resources/js/spa/stores/appearance.ts.
    $response = $this->get('/');

    $response->assertSee("localStorage.getItem('spa.appearance')", false);
    $response->assertSee('meta name="theme-color"', false);
});
