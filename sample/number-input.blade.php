<script setup>
    import { TodoItem } from './resources/js/types'

    mount((props: {
        showCompleted: boolean,   
    }) => ({
        todos: [] as TodoItem[],
        get filtered() {
            return props.showCompleted
                ? this.todos
                : this.todos.filter(i => ! i.done)
        }
    }))
</script>

<div {{ $attributes }}>
    <template x-for="todo of todos">
        <x-todo-item x-todo="todo" x-on:click="(e) => {
            
        }" />
    </tamplate>
</div>
