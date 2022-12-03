import Database from 'better-sqlite3';
import * as utils from '#models/utils.mjs';

const client = new Database(process.env.SQLITE_DB_PATH);

async function init_db() {
	try {
		/* SQLite doesn't have a recovery from dropping talbe. No need to include it in transaction */
		if (process.env.RUN == "dev") {
			const all_tables = client.prepare(`
				select 
					name 
				from 
					sqlite_schema 
				where 
					type ='table' AND 
					name NOT LIKE 'sqlite_%' AND
					name NOT LIKE 'item_search_%' -- SQLite tables for item_search virtual table
				;
			`).all();
			/* Chaning foreign_keys doesn't work when in a transaction */
			client.pragma('foreign_keys = OFF');
			all_tables.map((table, idx, arr) => {
				client.exec(`drop table ${table.name};`);
			});
			client.pragma('foreign_keys = ON');
			console.log("dropped all tables");
			console.log("recreating tables");
		}

		client.transaction(() => {
			client.exec(`
				create table if not exists 
					user_ (
						username TEXT primary key, 
						reddit_api_refresh_token_encrypted TEXT, -- decrypt ➔ string
						category_sync_info JSON, 
						last_updated_epoch INTEGER, 
						last_active_epoch INTEGER
					)
				;
			`);
		
			client.exec(`
				create table if not exists 
					item (
						id TEXT primary key, 
						type TEXT not null, 
						content TEXT not null, 
						author TEXT not null, 
						sub TEXT not null, 
						url TEXT not null, 
						created_epoch INTEGER not null
					)
				;
			`);

			/** 
			 * SQLite alternative to tsvector
			 * It doesn't have option for types or custom primary key
			 * We need to use the rowid default column that all tables have
			 * https://www.sqlite.org/fts5.html
			 */
			client.exec(`
				create virtual table if not exists 
					item_search using fts5(
						id,
						search_vector
					)
				;
			`);
	
			client.exec(`
				create table if not exists 
					item_fn_to_import (
						id TEXT primary key, 
						fn_prefix TEXT not null
					)
				;
			`);
		
			client.exec(`
				create table if not exists 
					user_item (
						username TEXT not null references user_ (username), 
						category TEXT not null, 
						item_id TEXT not null, 
			
						unique (username, category, item_id)
					)
				;
			`);
	
			client.exec(`
				create table if not exists 
					item_sub_icon_url (
						sub TEXT primary key, 
						url TEXT not null
					)
				;
			`);
		})();
	} catch (err) {
		console.error(err);
	}
}

async function transaction(queries) {
	try {
		client.transaction(() => {
			for (const query of queries) {
				console.log(query.text);
				console.log(query.values);
				client.prepare(query.text).run(query.values);
			}
		})();
	} catch (err) {
		console.error(err);
	}
}

async function save_user(username, reddit_api_refresh_token_encrypted, category_sync_info, last_active_epoch) {
	client.prepare(`
		insert into 
			user_ 
		values (
			'${username}', 
			'${reddit_api_refresh_token_encrypted}', 
			'${JSON.stringify(category_sync_info)}', 
			null, 
			${last_active_epoch}
		) 
		on conflict (username) do -- previously purged user
			update 
				set 
					reddit_api_refresh_token_encrypted = excluded.reddit_api_refresh_token_encrypted, 
					category_sync_info = excluded.category_sync_info, 
					last_updated_epoch = excluded.last_updated_epoch, 
					last_active_epoch = excluded.last_active_epoch
		;
	`).run();
}

async function update_user(username, fields) {
	client.prepare(`
		update 
			user_ 
		set 
			${Object.keys(fields).map((field, idx, arr) => `${field} = ${(typeof fields[field] == "string" ? "'" : "")}${fields[field]}${(typeof fields[field] == "string" ? "'" : "")}${(idx < arr.length-1 ? "," : "")}`).join(" ")} 
		where 
			username = '${username}'
		;
	`).run();
}

async function get_user(username) {
	return client.prepare(`
		select 
			* 
		from 
			user_ 
		where 
			username = '${username}'
		;
	`).get();
}

async function purge_user(username) {
	await transaction([`
		update 
			user_ 
		set 
			reddit_api_refresh_token_encrypted = null, 
			category_sync_info = null, 
			last_updated_epoch = null, 
			last_active_epoch = null 
		where 
			username = '${username}'
		;
	`, `
		delete 
		from 
			user_item 
		where 
			username = '${username}'
		;
	`, `
		delete 
		from 
			item 
		where 
			id not in (
				select 
					item_id 
				from 
					user_item
			)
		;
	`, `
		delete 
		from 
			item_fn_to_import 
		where 
			id not in (
				select 
					item_id 
				from 
					user_item
			)
		;
	`, `
		delete 
		from 
			item_sub_icon_url 
		where 
			sub not in (
				select 
					sub 
				from 
					item
			)
		;
	`]);
}

async function get_all_non_purged_users() {
	const rows = client.prepare(`
		select 
			username 
		from 
			user_ 
		where 
			reddit_api_refresh_token_encrypted is not null
		;
	`).all();
	return rows;
}

/**
 * Split big queries due to a limit of parameters in SQLite
 * 32,766 since SQLite 3.32.0 (in better-sqlite3 since v7.1.0 )
 * https://www.sqlite.org/limits.html#max_variable_number
 * 
 * @param {Array.<{text: Array, values: Array}[]>} statements Well formatted prepared statements array
 * @param {Number} [duplicate_values=0] How many values should be duplicated for all splits
 */
function split_prepared_statements(statements, duplicate_values = 0) {
	const max_parameters = 32_766;
	let res = [];
	for (const statement of statements) {
		let parameters_per_entry = (statement.text[1][0].match(/\?/g) || []).length;
		let items_per_chunk = parseInt((max_parameters / parameters_per_entry));
		let parameters_per_chunk = items_per_chunk * parameters_per_entry;
		let default_values = statement.values.slice(0, duplicate_values);

		let reducer = (result, value, idx) => {
			const chunkIdx = Math.floor(idx/items_per_chunk);

			if (!result[chunkIdx]) {
				result[chunkIdx] = [];
			}

			result[result.length - 1].push(value);

			return result;
		};
		let split = [];

		split.push(statement.text[1].reduce(reducer, []));
		items_per_chunk = parameters_per_chunk;
		split.push(statement.values.reduce(reducer, []));

		split[0].forEach((value, idx) => {
			res.push({
				text: [
					statement.text[0],
					value,
					statement.text[2]
				],
				values: default_values.concat(split[1][idx])
			})
		});
	}
	return res;
}

async function insert_data(username, data) {
	if (Object.keys(data.items).length == 0) {
		return;
	}
	
	const prepared_statements = [{
		text: [`
			insert into 
				item 
			values`,
				[],
			`on conflict (id) do 
				nothing
			;
		`],
		values: []
	}, {
		text: [`
			insert or ignore into 
				item_search (rowid, id, search_vector)
			values`,
				[],
			`` /* Virtual tables don't allow on conflict (UPSERT) */
		],
		values: []
	}, {
		text: [`
			insert into 
				user_item 
			values`,
				[],
			`on conflict (username, category, item_id) do 
				nothing
			;
		`],
		values: []
	}, {
		text: [`
			insert into 
				item_sub_icon_url 
			values`,
				[],
			`on conflict (sub) do 
				update 
					set 
						url = excluded.url
			;
		`],
		values: []
	}];

	let entries = Object.entries(data.items);
	let items_idx = 0;
	let items_search_idx = 1;
	for (const entry of entries) {
		const item_key = entry[0];
		const item_value = entry[1];

		prepared_statements[items_idx].text[1].push(`(?, ?, ?, ?, ?, ?, ?)`);
		prepared_statements[items_search_idx].text[1].push(`((select rowid from item where id='${item_key}'), ?, ?)`);

		prepared_statements[items_idx].values.push(item_key, item_value.type, item_value.content, item_value.author, item_value.sub, item_value.url, item_value.created_epoch);
		prepared_statements[items_search_idx].values.push(item_key, `${item_value.sub} ${item_value.author} ${item_value.content}`);
	}

	for (const category in data.category_item_ids) {
		for (const item_id of data.category_item_ids[category]) {
			prepared_statements[2].text[1].push(`(?, ?, ?)`);

			prepared_statements[2].values.push(username, category, item_id);
		}
	}

	entries = Object.entries(data.item_sub_icon_urls);
	for (const entry of entries) {
		prepared_statements[3].text[1].push(`(?, ?)`);

		const icon_url_key = entry[0];
		const icon_url_value = entry[1];
		prepared_statements[3].values.push(icon_url_key, icon_url_value);
	}

	const statements = split_prepared_statements(prepared_statements);
	for (const statement of statements) {
		statement.text[1] = statement.text[1].join(", ");
		statement.text = statement.text.join(" ");
	}
	await transaction(statements);
}

async function get_data(username, filter, item_count, offset) {
	const data = {
		items: {},
		item_sub_icon_urls: {}
	};

	const prepared_statement = {
		text: [`
			select 
				id, 
				type, 
				content, 
				author, 
				sub, 
				url, 
				created_epoch 
			from 
				item inner join user_item on id = item_id 
			where 
				username = '${username}' 
				and category = ?`,
				[],
			`order by 
				created_epoch desc 
			limit 
				${(Number.isInteger(item_count) || item_count == "all" ? item_count : null)} 
			offset 
				${(Number.isInteger(offset) ? offset : null)}
			;
		`],
		values: [
			filter.category
		]
	};

	if (filter.type != "all") {
		prepared_statement.text[1].push(`and type = ?`);

		prepared_statement.values.push(filter.type);
	}

	if (filter.sub != "all") {
		prepared_statement.text[1].push(`and sub = ?`);

		prepared_statement.values.push(filter.sub);
	}

	if (filter.search_str != "") {
		prepared_statement.text[1].push(`and search_vector @@ to_tsquery(?)`);

		const psql_fts_search_str = filter.search_str.replaceAll(" ", " AND ");
		prepared_statement.values.push(psql_fts_search_str);
	}

	prepared_statement.text[1] = prepared_statement.text[1].join(" ");
	prepared_statement.text = prepared_statement.text.join(" ");
	let rows = client.prepare(prepared_statement).all();
	
	const subs = new Set();
	for (const obj of rows) {
		data.items[obj.id] = ((({id, ...rest}) => rest)(obj));
		subs.add(obj.sub);
	}
	if (subs.size > 0) {
		rows = client.prepare(`
			select 
				* 
			from 
				item_sub_icon_url 
			where 
				${[...subs].map((sub, idx, arr) => `${(idx == 0 ? "" : "or ")}sub = '${sub}'`).join(" ")}
			;
		`).all();

		for (const obj of rows) {
			data.item_sub_icon_urls[obj.sub] = obj.url;
		}
	}

	return data;
}

async function get_placeholder(username, filter) {
	const prepared_statement = {
		text: [`
			select 
				count(*) 
			from 
				item inner join user_item on id = item_id 
			where 
				username = '${username}' 
				and category = $1`,
				"",
			`;
		`],
		values: [
			filter.category
		]
	};

	if (filter.type != "all") {
		prepared_statement.text[1] = "and type = $2";
		prepared_statement.values.push(filter.type);
	}

	prepared_statement.text = prepared_statement.text.join(" ");
	const count = client.prepare(prepared_statement).get().count;

	const placeholder = Number.parseInt(count);
	return placeholder;
}

async function get_subs(username, filter) {
	const prepared_statement = {
		text: [`
			select 
				distinct sub 
			from 
				item inner join user_item on id = item_id 
			where 
				username = '${username}' 
				and category = $1`,
				"",
			`order by
				sub asc
			;
		`],
		values: [
			filter.category
		]
	};

	if (filter.type != "all") {
		prepared_statement.text[1] = "and type = $2";
		prepared_statement.values.push(filter.type);
	}

	prepared_statement.text = prepared_statement.text.join(" ");
	const rows = client.prepare(prepared_statement).all();

	const subs = rows.map((obj, idx, arr) => obj.sub);
	return subs;
}

async function update_item(item_id, item_content) {
	client.prepare({
		text: `
			update 
				item 
			set 
				content = $1 
			where 
				id = $2
			;
		`,
		values: [
			item_content,
			item_id
		]
	}).run();
}

async function delete_item_from_expanse_acc(username, item_id, item_category) {
	await transaction([{
		text: `
			delete 
			from 
				user_item 
			where 
				username = '${username}' 
				and category = $1 
				and item_id = $2
			;
		`,
		values: [
			item_category,
			item_id
		]
	}, {
		text: `
			delete 
			from 
				item 
			where 
				id = $1 
				and not exists (
					select 
						1 
					from 
						user_item 
					where 
						item_id = $2
				)
			;
		`,
		values: [
			item_id,
			item_id
		]
	}]);
}

async function parse_import(username, import_data) {
	const prepared_statement_1 = {
		text: [`
			insert into 
				item_fn_to_import 
			values`,
				[],
			`on conflict (id) do 
				nothing
			;
		`],
		values: []
	};

	const prepared_statement_2 = {
		text: [`
			insert into 
				user_item 
			values`,
				[],
			`on conflict (username, category, item_id) do 
				nothing
			;
		`],
		values: []
	};

	const prepared_statements = [];
	let active_ps_idx = -1;

	import_data.item_fns = [...(import_data.item_fns)];
	for (const category in import_data.category_item_ids) {
		import_data.category_item_ids[category] = [...(import_data.category_item_ids[category])];
	}
	
	for (let i = 0; i < import_data.item_fns.length; i++) {
		if (i % 1000 == 0) {
			prepared_statements.push(JSON.parse(JSON.stringify(prepared_statement_1)));
			active_ps_idx++;
		}

		prepared_statements[active_ps_idx].text[1].push(`(?, ?)`);

		const fn = import_data.item_fns[i];
		const item_fn_prefix = fn.split("_")[0];
		const item_id = fn.split("_")[1];
		prepared_statements[active_ps_idx].values.push(item_id, item_fn_prefix);
	}

	for (const category in import_data.category_item_ids) {
		for (let i = 0; i < import_data.category_item_ids[category].length; i++) {
			if (i % 1000 == 0) {
				prepared_statements.push(JSON.parse(JSON.stringify(prepared_statement_2)));
				active_ps_idx++;
			}

			prepared_statements[active_ps_idx].text[1].push(`(?, ?, ?)`);

			const item_id = import_data.category_item_ids[category][i];
			prepared_statements[active_ps_idx].values.push(username, category, item_id);
		}
	}

	for (const statement of prepared_statements) {
		statement.text[1] = statement.text[1].join(", ");
		statement.text = statement.text.join(" ");
	}
	await transaction(prepared_statements);
}

async function get_fns_to_import(username, category) {
	const rows = client.prepare(`
		select 
			id, 
			fn_prefix 
		from 
			item_fn_to_import join user_item on id = item_id 
		where 
			username = '${username}' 
			and category = '${category}' 
		limit 
			500
		;
	`).all();
	return rows;
}

async function delete_imported_fns(fns) {
	if (fns.length == 0) {
		return;
	}
	
	client.prepare({
		text: `
			delete 
			from 
				item_fn_to_import 
			where 
				${fns.map((fn, idx, arr) => `${(idx == 0 ? "" : "or ")}id = $${idx+1}`).join(" ")}
			;
		`,
		values: fns.map((fn, idx, arr) => fn.split("_")[1])
	}).run();
}

async function close_db_connection() {
	return client.close();
}

function dump_db(path, cb) {
	const filename = utils.epoch_to_formatted_datetime(utils.now_epoch()).replaceAll(":", "꞉").split(" ").join("_");

	/* Remove trailing slash */
	path = path.replace(/\/$/, '');

	const file = `${path}/${filename}.db`;

	client.backup(file)
		.then(() => {
			console.log(`backed up db to file (${filename}.db)`);
			cb();
		})
		.catch((err) => {
			console.error(`db backup failed: ${err}`);
		});
}

export {
	init_db,
	save_user,
	update_user,
	get_user,
	purge_user,
	get_all_non_purged_users,
	insert_data,
	get_data,
	get_placeholder,
	get_subs,
	update_item,
	delete_item_from_expanse_acc,
	parse_import,
	get_fns_to_import,
	delete_imported_fns,
	close_db_connection,
	dump_db
};
