<script context="module">
	import ItemRow from "./item_row.svelte";
	import { afterUpdate, createEventDispatcher } from 'svelte';
	import underscore from "underscore";
</script>
<script>
	export let items;
	export let hide = true;

	let list;
	let observedItem;

	const dispatch = createEventDispatcher();

	const intersection_observer = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (entry.intersectionRatio > 0) { // observed element is in view
				intersection_observer.unobserve(entry.target);
				dispatch('reachingEnd', null);
			}
		}
	}, {
		root: document,
		rootMargin: "0px",
		threshold: 0
	});

	afterUpdate(() => {
		jQuery("[data-toggle='popover']").popover("hide");
		jQuery('[data-toggle="tooltip"]').tooltip("enable");
		jQuery('[data-toggle="popover"]').popover("enable");
		intersection_observer.disconnect();
		if (items.length > 0) {
			let item_id = items[Math.min(items.length-1, 10)][0];
			intersection_observer.observe(document.querySelector(`[id="${item_id}"]`));
		}
	});
</script>

{#if items.length == 0}
	<div class="list-group-item text-light lead">No results</div>
{:else}
	<div bind:this={list} class:d-none="{hide}" class="list-group list-group-flush border-0" id="item_list">
		{#each items as item}
			<ItemRow value={item} />
		{/each}
	</div>
{/if}