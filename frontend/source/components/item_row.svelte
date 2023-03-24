<script context="module">
	import * as globals from "frontend/source/globals.js";
	import * as utils from "frontend/source/utils.js";
	import { itemModalData } from '../store.js';
	import underscore from "underscore";

	const globals_r = globals.readonly;
</script>
<script>
	export let value;

	let item_id = value[0];
	let item = value[1];
	let subIcon = value[2];

	function getPluginData(event) {
		globals_r.socket.emit("get plugin data", event.target.parentElement.id);
		globals_r.socket.once("got plugin data", (data) => {
			$itemModalData = data;
		});
	}
</script>

<div id="{item_id}" class="list-group-item list-group-item-action text-left text-light p-1" data-url="{item.url}" data-type="{item.type}">
	<a href="https://www.reddit.com/{item.sub}" target="_blank">
		<img src="{subIcon}" alt="{item.sub} icon" class="icon rounded-circle{(subIcon == "#" ? "" : " border border-light")}"/>
	</a>
	<small>
		<a href="https://www.reddit.com/{item.sub}" target="_blank">
			<b class="ml-2">{item.sub}</b>
		</a> &bull; 
		<a href="https://www.reddit.com/{item.author}" target="_blank">{item.author}</a> &bull; 
		<i data-url="{item.url}" data-toggle="tooltip" data-placement="top" title="{utils.epoch_to_formatted_datetime(item.created_epoch)}">{utils.time_since(item.created_epoch)}</i>
	</small>
	<p class="lead line_height_1 m-0" data-url="{item.url}">
		{#if item.type == "post"}
			<p class="content_wrapper noto_sans">{underscore.escape(item.content)}</p>
		{:else}
			<small class="content_wrapper noto_sans">{underscore.escape(item.content)}</small>
		{/if}
	</p>
	<button type="button" class="delete_btn btn btn-sm btn-outline-secondary shadow-none border-0 py-0" data-toggle="popover" data-placement="right" data-title="delete item from" data-content='<div class="{item_id}"><div><span class="row_1_popover_btn btn btn-sm btn-primary float-left px-0">expanse</span><span class="row_1_popover_btn btn btn-sm btn-primary float-center px-0">Reddit</span><span class="row_1_popover_btn btn btn-sm btn-primary float-right px-0">both</span></div><div><span class="row_2_popover_btn btn btn-sm btn-secondary float-left mt-2">cancel</span><span class="row_2_popover_btn delete_item_confirm_btn btn btn-sm btn-danger float-right mt-2">confirm</span></div><div class="clearfix"></div></div>' data-html="true">delete</button> 
	<button type="button" class="copy_link_btn btn btn-sm btn-outline-secondary shadow-none border-0 py-0">copy link</button> 
	<button type="button" class="{(item.type == "post" ? "text" : "renew")}_btn btn btn-sm btn-outline-secondary shadow-none border-0 py-0">{(item.type == "post" ? "text" : "renew")}</button>
	<button type="button" on:click={getPluginData} class="btn btn-sm btn-outline-secondary shadow-none border-0 py-0">Plugins data</button> 
	{#if item.type == "post"}
		<p class="post_text_wrapper noto_sans line_height_1 d-none m-0"></p>
	{/if}
</div>