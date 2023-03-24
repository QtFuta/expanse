<script>
    import { onDestroy } from 'svelte';
	import { itemModalData } from '../store.js';

	let modalContent = null;
	export let activeTabValue = 0;

  	const handleClick = tabValue => () => (activeTabValue = tabValue);

	const unsubscribe = itemModalData.subscribe((value => {	
		modalContent = value;
	}));

	onDestroy(unsubscribe);
</script>

{#if modalContent}
<div on:click|self={() => modalContent = null} class='modal'>
	<div class='content wrapper'>
		<ul>
			{#each modalContent as item, idx}
				<li class={activeTabValue === idx ? 'active' : ''}>
					<span on:click={handleClick(idx)}>{item.id}</span>
				</li>
			{/each}
			{#each modalContent as item, idx}
				{#if activeTabValue == idx}
					<div class="box">
						{@html item.data}
					</div>
				{/if}
			{/each}
		</ul>
	</div>
</div>
{/if}

<style>
	.modal {
		background-color: rgba(0, 0, 0, 0.4);
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
	}
	
	.content {
		background-color: white;
		position: absolute;
		width: 90%;
		height: 90%;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
	}

	.box {
		margin-bottom: 10px;
		border: 1px solid #dee2e6;
		border-radius: 0 0 .5rem .5rem;
		border-top: 0;
		overflow: scroll;
		height: 100%;
	}
	ul {
		display: flex;
		flex-wrap: wrap;
		padding-left: 0;
		margin-bottom: 0;
		list-style: none;
		border-bottom: 1px solid #dee2e6;
		height: 100%;
	}
	li {
		margin-bottom: -1px;
	}

	span {
		border: 1px solid transparent;
		border-top-left-radius: 0.25rem;
		border-top-right-radius: 0.25rem;
		display: block;
		padding: 0.5rem 1rem;
		cursor: pointer;
	}

	span:hover {
		border-color: #e9ecef #e9ecef #dee2e6;
	}

	li.active > span {
		color: #495057;
		background-color: #fff;
		border-color: #dee2e6 #dee2e6 #fff;
	}
</style>