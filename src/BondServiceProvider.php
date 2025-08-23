<?php

namespace Ganyicz\Bond;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Blade;

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
        Blade::prepareStringsForCompilationUsing(function ($value) {
            $path = app('blade.compiler')->getPath();

            return preg_replace_callback(
                '/<script\s[^>]*\bsetup\b[^>]*>.*?<\/script>/s',
                function () use ($path) {
                    $componentName = str($path)
                        ->after(resource_path('views/'))
                        ->before('.blade.php')
                        ->replace('/', '.');
                    
                    return
                        <<<BLADE
                        @php
                        \$attributes = new \Illuminate\View\ComponentAttributeBag(
                            collect(\$attributes)
                                ->merge(['x-data' => true, 'x-component' => '{$componentName}'])
                                ->map(fn (\$v, \$k) => str_starts_with(\$k, 'x-') && \$v === true ? '' : \$v)
                                ->all()
                        );
                        @endphp
                        BLADE
                    ;
                },
                $value
            );
        });
    }
}
