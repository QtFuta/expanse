<script context="module">
	import * as globals from "frontend/source/globals.js";
	import * as utils from "frontend/source/utils.js";
	import Navbar from "frontend/source/components/navbar.svelte";
	import ItemList from "./item_list.svelte";
	import PluginDataModal from "./plugin_data_modal.svelte";

	import * as svelte from "svelte";
	import axios from "axios";
	import underscore from "underscore";

	const globals_r = globals.readonly;
</script>
<script>
	export let username;
	
	let items = [];
	let isLoading = true;
	let isDataProvided = true;
	let [
		last_updated_epoch,
		last_updated_wrappers_update_interval_id,
		last_updated_wrapper_1,
		last_updated_wrapper_2,
		search_input,
		search_btn,
		subreddit_select,
		subreddit_select_btn,
		subreddit_select_dropdown,
		category_btn_group,
		type_btn_group,
		skeleton_list,
		new_data_alert_wrapper
	] = [];

	let active_category = "saved";
	let active_type = "all";
	let active_sub = "all";
	let active_search_str = "";

	async function handle_body_click(evt) {
		(evt.target.classList.contains("dropdown-item") || evt.target.parentElement?.classList.contains("dropdown-item") ? subreddit_select_btn.blur() : null);

		if (evt.target.dataset?.url) {
			window.open(evt.target.dataset.url, "_blank");
		} else if (evt.target.parentElement?.dataset?.url && evt.target.tagName != "BUTTON") {
			window.open(evt.target.parentElement.dataset.url, "_blank");
		}

		if (evt.target.classList.contains("copy_link_btn") || evt.target.classList.contains("text_btn") || evt.target.classList.contains("renew_btn")) {
			evt.target.classList.remove("btn-outline-secondary");
			evt.target.classList.add("btn-success");
			setTimeout(() => {
				evt.target.classList.remove("btn-success");
				evt.target.classList.add("btn-outline-secondary");
			}, 500);

			if (evt.target.classList.contains("copy_link_btn")) {
				window.navigator.clipboard.writeText(evt.target.parentElement.dataset.url).catch((err) => console.error(err));
			} else if (evt.target.classList.contains("text_btn")) {
				const post_text_wrapper = evt.target.parentElement.querySelector(".post_text_wrapper");
				if (post_text_wrapper.innerHTML == "") {
					try {
						const post_id = evt.target.parentElement.id;
						
						const response = await axios.get(`https://api.pushshift.io/reddit/search/submission?ids=${post_id}&fields=selftext`);
						const response_data = response.data;

						const post_text = response_data.data[0].selftext;
						post_text_wrapper.innerHTML = (post_text ? underscore.escape(post_text) : "[this is not a text post]");
					} catch (err) {
						console.error(err);
						post_text_wrapper.innerHTML = "[error: pushshift currently down. please try again later]";
					}
				}
				post_text_wrapper.classList.toggle("d-none");
			} else if (evt.target.classList.contains("renew_btn")) {
				const comment_id = evt.target.parentElement.id;

				globals_r.socket.emit("renew comment", comment_id);
				globals_r.socket.once("renewed comment", (comment_content) => {
					const content_wrapper = evt.target.parentElement.querySelector(".content_wrapper");
					content_wrapper.innerHTML = underscore.escape(comment_content);
				});
			}
		}
		
		if (evt.target.classList.contains("delete_btn")) {
			const item_id = evt.target.parentElement.id;

			const all_opened_popovers = document.querySelectorAll(".popover");
			for (const popover of all_opened_popovers) {
				const popover_item_id = popover.children[2].children[0].classList[0];
				
				(popover_item_id != item_id ? jQuery(popover).popover("hide") : null);
			}
		} else if (evt.target.classList.contains("row_1_popover_btn")) {
			const all_row_1_popover_btns = document.querySelectorAll(".row_1_popover_btn");
			for (const btn of all_row_1_popover_btns) {
				if (btn != evt.target) {
					btn.classList.remove("active");
				} else {
					btn.classList.toggle("active");
				}
			}
		} else if (evt.target.classList.contains("delete_item_confirm_btn")) {
			const opened_popover = document.querySelector(".popover");

			let delete_from = null;
			const all_row_1_popover_btns = document.querySelectorAll(".row_1_popover_btn");
			for (const btn of all_row_1_popover_btns) {
				(btn.classList.contains("active") ? delete_from = btn.innerHTML : null);
			}
			if (!delete_from) {
				for (const btn of [...all_row_1_popover_btns]) {
					utils.shake_element(btn);
				}
				return;
			} else {
				jQuery(opened_popover).popover("hide");
			}

			const item_id = evt.target.parentElement.parentElement.classList[0];
			const item_category = active_category;
			const item_type = document.querySelector(`[id="${item_id}"]`).dataset.type;

			if (delete_from == "expanse" || delete_from == "both") {
				const list_item = document.querySelector(`[id="${item_id}"]`);
				list_item.innerHTML = "";
				list_item.removeAttribute("data-url");
				list_item.removeAttribute("data-type");
				list_item.className = "";
				list_item.classList.add("skeleton_item", "rounded", "mb-2");

				try {
					globals_r.socket.emit("delete item from expanse acc", item_id, item_category);
	
					list_item.remove();
				} catch (err) {
					console.error(err);
				}
			}
			if (delete_from == "Reddit" || delete_from == "both") {
				globals_r.socket.emit("delete item from reddit acc", item_id, item_category, item_type);
			}
		} else if (!evt.target.classList.contains("row_2_popover_btn") && document.querySelector(".popover")?.contains(evt.target)) {
			null;
		} else {
			jQuery("[data-toggle='popover']").popover("hide");
		}

		if (evt.target.parentElement == category_btn_group) {
			const selected_category = await new Promise((resolve, reject) => {
				setTimeout(() => {
					let category = null;
					for (const btn of [...(category_btn_group.children)]) {
						(btn.classList.contains("active") ? category = btn.innerText : null);
					}
					resolve(category);
				}, 100);
			});
			if (selected_category != active_category) {
				active_category = selected_category;
				try {
					await refresh_item_list();
					update_search_placeholder().catch((err) => console.error(err));
					fill_subreddit_select().catch((err) => console.error(err));
				} catch (err) {
					console.error(err);
				}
			}
		} else if (evt.target.parentElement == type_btn_group) {
			const selected_type = await new Promise((resolve, reject) => {
				setTimeout(() => {
					let type = null;
					for (const btn of [...(type_btn_group.children)]) {
						(btn.classList.contains("active") ? type = btn.innerText : null);
					}
					resolve(type);
				}, 100);
			});
			if (selected_type != active_type) {
				active_type = selected_type;
				try {
					await refresh_item_list();
					update_search_placeholder().catch((err) => console.error(err));
					fill_subreddit_select().catch((err) => console.error(err));
				} catch (err) {
					console.error(err);
				}
			}
		}

		if (evt.target.id == "refresh_btn") {
			new_data_alert_wrapper.classList.add("d-none");
			try {
				await refresh_item_list();
				update_search_placeholder().catch((err) => console.error(err));
				fill_subreddit_select().catch((err) => console.error(err));
			} catch (err) {
				console.error(err);
			}
		}
	}

	function handle_body_keydown(evt) {
		if (evt.key == "Escape") {
			jQuery("[data-toggle='popover']").popover("hide");
		}
		
		setTimeout(() => {
			const no_results = document.querySelector(".no-results");
			(no_results && !no_results.classList.contains("d-none") ? no_results.classList.add("d-none") : null);

			(subreddit_select_dropdown && typeof subreddit_select_dropdown != "number" && !subreddit_select_dropdown.classList.contains("show") ? subreddit_select_btn.blur() : null);
		}, 100);
	}

	function show_skeleton_loading() {
		isLoading = true;
		skeleton_list.classList.remove("d-none");
	}

	function hide_skeleton_loading() {
		skeleton_list.classList.add("d-none");
		isLoading = false;
	}

	function is_data_provided() {
		isDataProvided = !(active_type == "comments" && (active_category == "upvoted" || active_category == "downvoted" || active_category == "hidden"));
		return isDataProvided;
	}

	async function list_next_items(count) {
		if (!is_data_provided()) {
			return;
		}

		const filter = {
			category: active_category,
			type: (active_type == "all" ? active_type : active_type.slice(0, -1)),
			sub: active_sub,
			search_str: active_search_str
		};
		globals_r.socket.emit("get data", filter, count, items.length);

		await new Promise((resolve, reject) => {
			globals_r.socket.once("got data", (data) => {
				if (items.length == 0 && Object.keys(data.items).length == 0) {
					resolve();
				}

				const newItems = Object.entries(data.items).map((value) => {
					return [
						...value,
						data.item_sub_icon_urls[value[1].sub]
					];
				});
				items = [...items, ...newItems];

				resolve();
			});
		});
	}

	function getMoreItems() {
		list_next_items(25).catch((err) => console.error(err));
	}

	async function refresh_item_list() {
		items = [];

		await list_next_items(25);
	}

	async function update_search_placeholder() {
		const filter = {
			category: active_category,
			type: (active_type == "all" ? active_type : active_type.slice(0, -1))
		};
		globals_r.socket.emit("get placeholder", filter);

		await new Promise((resolve, reject) => {
			globals_r.socket.once("got placeholder", (placeholder) => {
				search_input.placeholder = `search ${placeholder} item${(placeholder == 1 ? "" : "s")}`;
				resolve();
			});
		});
	}

	async function fill_subreddit_select() {
		subreddit_select.innerHTML = "<option>all</option>";

		const filter = {
			category: active_category,
			type: (active_type == "all" ? active_type : active_type.slice(0, -1))
		};
		globals_r.socket.emit("get subs", filter);

		await new Promise((resolve, reject) => {
			globals_r.socket.once("got subs", (subs) => {
				for (const sub of subs) {
					subreddit_select.insertAdjacentHTML("beforeend", `
						<option>${sub}</option>
					`);
				}
				jQuery(subreddit_select).selectpicker("refresh");
				jQuery(subreddit_select).selectpicker("render");

				resolve();
			});
		});
	}

	svelte.onMount(async () => {
		globals_r.socket.emit("page", "access");
		
		globals_r.socket.on("store last updated epoch", (epoch) => {
			last_updated_epoch = epoch;
		});

		globals_r.socket.on("show refresh alert", (categories_w_new_data) => {
			for (const category of categories_w_new_data) {
				if (category == active_category) {
					new_data_alert_wrapper.classList.remove("d-none");
					utils.show_alert(new_data_alert_wrapper, '<span class="ml-1">new data available!</span><button id="refresh_btn" class="btn btn-sm btn-primary ml-2">refresh</button>', "primary");
					break;
				}
			}
		});

		last_updated_wrappers_update_interval_id = setInterval(() => {
			if (last_updated_epoch) {
				last_updated_wrapper_1.innerHTML = utils.time_since(last_updated_epoch);
				last_updated_wrapper_2.innerHTML = utils.epoch_to_formatted_datetime(last_updated_epoch);
			}
		}, 1000);

		try {
			await refresh_item_list();
			hide_skeleton_loading();
			update_search_placeholder().catch((err) => console.error(err));
			fill_subreddit_select().catch((err) => console.error(err));
		} catch (err) {
			console.error(err);
		}

		jQuery(subreddit_select).selectpicker();
		subreddit_select_btn = document.querySelector(".bs-placeholder");
		subreddit_select_dropdown = document.querySelector(".bootstrap-select");

		jQuery(subreddit_select).on("changed.bs.select", (evt, clicked_idx, is_selected, previous_value) => { // https://developer.snapappointments.com/bootstrap-select/options/#events
			active_sub = evt.target.value;
			refresh_item_list().catch((err) => console.error(err));
			update_search_placeholder().catch((err) => console.error(err));
		});

		last_updated_wrapper_1.addEventListener("click", (evt) => {
			last_updated_wrapper_2.classList.toggle("d-none");
		});

		last_updated_wrapper_2.addEventListener("click", (evt) => {
			evt.target.classList.toggle("d-none");
		});

		subreddit_select_btn.addEventListener("click", (evt) => {
			(!subreddit_select_dropdown.classList.contains("show") ? subreddit_select_btn.blur() : null);
		});

		search_input.addEventListener("keydown", (evt) => {
			if (evt.target.value.trim() == "") {
				return;
			}

			switch (evt.key) {
				case "Enter":
					active_search_str = evt.target.value.trim();
					refresh_item_list().catch((err) => console.error(err));
					break;
				case "Escape":
					evt.target.value = "";
					active_search_str = "";
					refresh_item_list().catch((err) => console.error(err));
					break;
				case "Backspace":
				case "Delete":
					setTimeout(() => {
						if (active_search_str && evt.target.value.trim() == "") {
							active_search_str = "";
							refresh_item_list();
						}
					}, 100);
					break;
				default:
					break;
			}
		});

		search_btn.addEventListener("click", (evt) => {
			search_input.dispatchEvent(new KeyboardEvent("keydown", {
				key: "Enter"
			}));
		});
	});
	svelte.onDestroy(() => {
		globals_r.socket.off("store last updated epoch");
		globals_r.socket.off("show refresh alert");

		clearInterval(last_updated_wrappers_update_interval_id);
	});
</script>

<svelte:body on:click={handle_body_click} on:keydown={handle_body_keydown}/>
<Navbar username={username} show_data_anchors={true}/>
<div class="text-center mt-3">
	<h1 class="display-4">{globals_r.app_name}</h1>
	<span>last updated: <b bind:this={last_updated_wrapper_1} id="last_updated_wrapper_1">?</b> ago</span>
	<br/>
	<small bind:this={last_updated_wrapper_2} class="d-none">?</small>
	<div class="d-flex justify-content-center">
		<div bind:this={new_data_alert_wrapper} class="px-1 d-none"></div>
	</div>
	<div id="access_container" class="card card-body bg-dark mt-3 pb-3">
		<form>
			<div class="form-row d-flex justify-content-center">
				<div bind:this={category_btn_group} class="btn-group btn-group-toggle flex-wrap" data-toggle="buttons">
					<label class="btn btn-secondary shadow-none active"><input type="radio" name="options"/>saved</label>
					<label class="btn btn-secondary shadow-none"><input type="radio" name="options"/>created</label>
					<label class="btn btn-secondary shadow-none"><input type="radio" name="options"/>upvoted</label>
					<label class="btn btn-secondary shadow-none"><input type="radio" name="options"/>downvoted</label>
					<label class="btn btn-secondary shadow-none"><input type="radio" name="options"/>hidden</label>
				</div>
			</div>
			<div class="form-row d-flex justify-content-center mt-2">
				<div bind:this={type_btn_group} class="btn-group btn-group-toggle flex-wrap" data-toggle="buttons">
					<label class="btn btn-secondary shadow-none"><input type="radio" name="options"/>posts</label>
					<label class="btn btn-secondary shadow-none"><input type="radio" name="options"/>comments</label>
					<label class="btn btn-secondary shadow-none active"><input type="radio" name="options"/>all</label>
				</div>
			</div>
			<div class="form-row mt-2">
				<div class="form-group col-12 col-sm-8 mb-0">
					<div class="d-flex input-group">
						<input bind:this={search_input} type="text" class="form-control bg-light" placeholder="search ? items"/>
						<div class="input-group-append"><button bind:this={search_btn} type="button" class="btn btn-light shadow-none"><i class="fa fa-search"></i></button></div>
					</div>
				</div>
				<div class="form-group col-12 col-sm-4 mb-0">
					<select bind:this={subreddit_select} class="selectpicker form-control" data-width="false" data-size="10" data-live-search="true" title="in subreddit: all">
						<option>all</option>
					</select>
				</div>
			</div>
		</form>
	</div>
	<div class="card card-body bg-dark border-top-0 mt-n2 pt-0 pb-2 pr-2">
		{#if isDataProvided}
			<ItemList on:reachingEnd={getMoreItems} items={items} hide={isLoading} />
		{:else}
			<div class="list-group-item text-light lead">{active_category} comment data not provided by Reddit api</div>
		{/if}
		<div bind:this={skeleton_list} class="list-group" id="skeleton_list">
			{#each {length: 7} as _, idx}
				<div class="skeleton_item rounded mb-2"></div>
			{/each}
		</div>
	</div>
	<PluginDataModal />
</div>
