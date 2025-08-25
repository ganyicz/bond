<?php

new class extends Component
{
    public int $amount = 0;
    public float $step = 0.5;

    public function save()
    {
        //
    }
} ?>

<script>
    mount((props: {
        step: number,
        min: number,
        max: number,
    }) => ({
        value: 0,
        clamp(n: number) {
            n = Math.max(props.min, n)
            n = Math.min(props.max, n)

            return n
        },
        increment() {
            this.value = this.clamp(this.value + props.step)
        }
    }))
</script>

<div {{ $attributes }}>
    <x-button
        x-data=({
            precisions: [0.001, 0.01, 0.1, 1, 10],
            get currentIndex() {
                return this.precisions.indexOf(this.$wire.precision);
            },
            prevPrecision() {
                this.$wire.precision = this.precisions[this.currentIndex - 1] || this.precisions[0];
            },
            nextPrecision() {
                this.$wire.precision = this.precisions[this.currentIndex + 1] || this.precisions[this.precisions.length - 1];
            },
        })
        x-on:click={this.value - step}
        x-step="this.value"
        x-on={$nextTick(() => {
            this.value
        })}
        onclick={this.value - step}
        class=({
            'bg-gray-200': this.value <= props.min,
            'bg-red-500': this.value > props.min,
        })
        x-data=({ value: 0, step: 1 })
        x-text={`- ${step}`}
        x-text={`+ {{ $this->step(run: true, $user) }}`}
        {{  $this->step }}
    />
    {{ $this->step(run: true) }}
    {{ $attributes }}
    <input type="number" x-model="value" x-bind:min="min" x-bind:max="max" />
    <button x-on:click="this.value + step">plus</button>
    <x-number-input model={$wire.amount} step={$wire.step} />
    <x-button onclick={$wire.save()} />
    <div mask={ '99/99/2024' }></div>
    {{-- <div x-text={ 'This is a comment' }></div> --}}

    <x-text>Input number between {this.value} and {max} and {
        this.clamp(this.value)
    }</x-text>
    
</div>

{{-- Comment --}}
