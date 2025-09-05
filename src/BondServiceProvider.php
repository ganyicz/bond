<?php

namespace Ganyicz\Bond;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Collection;
use Illuminate\View\ComponentAttributeBag;

class BondServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__ . '/../js/alpine.js' => public_path('vendor/alpine-bond-plugin.js'),
            ], 'bond-assets');
        }

        ComponentAttributeBag::macro('map', function ($callback) {
            /** @var ComponentAttributeBag $this */
            return new static((new Collection($this->attributes))->map($callback)->all());
        });

        Blade::prepareStringsForCompilationUsing(function ($value) {
            $path = app('blade.compiler')->getPath();

            return preg_replace_callback(
                '/<script\s[^>]*\bsetup\b[^>]*>.*?<\/script>/s',
                function () use ($path) {
                    $componentName = str($path)
                        ->after(resource_path('views/'))
                        ->before('.blade.php')
                        ->replace('/', '.');
                    
                    return <<<BLADE
                        @php
                        if (class_exists(\Livewire\Livewire::class)) {
                            \Livewire\Livewire::forceAssetInjection();
                        }
                        
                        \$attributes = \$attributes
                            ->map(fn (\$v, \$k) => \$v === true && str_starts_with(\$k, 'x-') ? '' : \$v)
                            ->merge(['x-data' => '', 'x-component' => '{$componentName}']);
                        @endphp
                        BLADE
                    ;
                },
                $value
            );
        });
    }
}
