import axios from 'axios';
import URL from 'node:url';
import { v1 as uuid } from 'uuid';
import fs from 'node:fs/promises';
import Database from 'better-sqlite3';

const dataPath = './plugins_data/media';
let client = new Database(process.env.SQLITE_DB_PATH);

let plugin = {
	getId() {
		return 'saveMedia';
	},
	async initialize() {
		await fs.mkdir(dataPath, {recursive: true});
		client = new Database(`${dataPath}/items.db`);
		client.transaction(() => {
			client.exec(`
				create table if not exists 
					item (
						id TEXT primary key, 
						url TEXT not null, 
						file TEXT not null
					)
				;
			`);
		})();
	},
	async getItem(user, item_id) {

	},
	async receiveItem(item) {
		// Nothing to do here
	},
	async receiveUserItem(user, category, item, config) {
		if (item.type !== 'post' || 
			category !== 'saved' || 
			(item.postType !== 'image' && item.postType !== 'gif' && item.postType !== 'video' && item.postType !== 'gallery')) {
			return;
		}
		if (item.postType === 'gallery') {
			let keys = Object.keys(item.snooItem.media_metadata);
			for (const key of keys) {
				await this.saveContent(user, item.snooItem.media_metadata[key].s.u, item.snooItem);
			}
		} else {
			await this.saveContent(user, item.snooItem.url, item.snooItem);
		}
	},
	getAvailableConfig() {

	},
	async saveContent(user, url, post) {
		const res = await this.getContent(url, post);
		if (res == null) return;
		url = res.request.res.responseUrl;
		const path = `${dataPath}/${user}`;
		await fs.mkdir(path, {recursive: true});
		const filePath = `${path}/${this.getFileName(url, res)}`;
		await fs.writeFile(filePath, res.data);
		this.saveInDB(post, url, filePath);
	},
	async saveInDB(post, url, filePath) {
		const query = 'INSERT INTO item values(?, ?, ?)';
		client.prepare(query).run(post.id, url, filePath);
	},
	async getContent(url, post) {
		if (url.includes('imgur') && url.includes('gifv')) url = url.replace(/\.gifv$/g, '.mp4');
		let res = await axios.get(url, {responseType: 'stream'});

		if (res.request.res.responseUrl !== "https://i.imgur.com/removed.png") return res;
		if (post == null) return null;

		res = await axios.get(post.preview.images[0].variants.mp4.source.url, {responseType: 'stream'});
		return res;
	},
	getFileName(url, response) {
		if (typeof url === 'string')
			url = URL.parse(url);
		const fileNameRegex = /([\w,\s-]+(\.[a-z0-9]{3,4}))$/i;
		const contentTypeRegex = /.+\/(\w+)/;
		let fileNameGroups;
		let fileExt = '';
		if (response.headers.has('content-disposition')) {
			const contentDispositionRegexp = /filename=\"(.+(\..+))\"/gi;
			fileExt = contentDispositionRegexp.exec(response.headers.get('content-disposition'))[2];
		}
		// This can be inconsistent with actual media type (e.g. imgur gif is mp4 file)
		// else if(fileNameGroups = fileNameRegex.exec(url.pathname)) {
		// 	fileExt = fileNameGroups[2];
		// }
		else {
			fileExt = '.'+contentTypeRegex.exec(response.headers.getContentType())[1];
		}
		return uuid() + fileExt;
	}
}

export {plugin}