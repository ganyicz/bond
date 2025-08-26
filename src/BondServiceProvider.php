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

            $componentName = str($path)
                ->after(resource_path('views/'))
                ->before('.blade.php')
                ->replace('/', '.');

            $hasScriptTag = false;

            $value = preg_replace_callback(
                '/<script\s[^>]*\bsetup\b[^>]*>.*?<\/script>/s',
                function () use ($componentName, &$hasScriptTag) {
                    $hasScriptTag = true;

                    return
                        <<<BLADE
                        @php
                        \$attributes = new \Illuminate\View\ComponentAttributeBag(
                            collect(\$attributes)
                                ->keyBy(fn (\$v, \$k) => str_starts_with(\$k, 'x-') ? \$k . '.prop' : \$k)
                                ->map(fn (\$v, \$k) => str_starts_with(\$k, 'x-') && \$v === true ? '' : \$v)
                                ->merge(['x-data' => '', 'x-component' => '{$componentName}'])
                                ->all()
                        );
                        @endphp
                        BLADE
                    ;
                },
                $value
            );

            if (! $hasScriptTag) {
                return $value;
            }

            $i = 0;

            $value = preg_replace_callback(
                '/\b(x-[\w.:\-_]+)\s*=\s*(["\'])(.*?)\2/su',
                function () use ($componentName, &$i) {
                    $attribute = "x-exp.{$i}=\"{$componentName}:{$i}\"";

                    $i++;

                    return $attribute;
                },
                $value
            );

            return $value;
        });
    }
}
