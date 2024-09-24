import axios from 'axios';
import URL from 'node:url';
import { v1 as uuid } from 'uuid';
import fs from 'node:fs/promises';
import Database from 'better-sqlite3';
import mime from 'mime';
import { randomBytes } from 'node:crypto';

const dataPath = './plugins_data/media';
let client;

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
						id TEXT, 
						url TEXT not null, 
						file TEXT not null
					)
				;
			`);
		})();
	},
	async getItem(user, item_id) {
		const item = client.prepare('SELECT * FROM item WHERE id=?').get(item_id);
		if (!item) return "<div>No data found</div>";
		const type = mime.getType(item.file);
		let tag = '';
		if(type.includes('image/')) tag = 'img';
		else if (type.includes('video')) tag = 'video';
		else if (type.includes('text/html')) tag = 'iframe';

		return `<${tag} src="plugins/${this.getId()}/${item_id}" style="width: 100%;height: 100%;object-fit: contain;" />`;
	},
	async handleRequest(req, res) {
		const item = client.prepare('SELECT * FROM item WHERE id=?').get(req.params['0']);
		if (!item) return res.sendStatus(404);

		res.sendFile(item.file, {root: './'});
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
		} else if (item.postType === 'video' && item.snooItem.domain === 'v.redd.it') {
			await this.saveContent(user, item.snooItem.media.reddit_video.fallback_url, item.snooItem);
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
		const fileNameData = this.getFileRelativePath(url, res);
		const fileSubPath = `${path}/${fileNameData.subPath}`;
		await fs.mkdir(fileSubPath, {recursive: true});
		const filePath = `${fileSubPath}/${fileNameData.fileName}`;
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
	getFileRelativePath(url, response) {
		if (typeof url === 'string')
			url = URL.parse(url);
		let fileExt = '';
		if (response.headers.has('content-disposition')) {
			const contentDispositionRegexp = /filename=\"(.+(\..+))\"/gi;
			fileExt = contentDispositionRegexp.exec(response.headers.get('content-disposition'))[2];
		}
		else {
			fileExt = '.'+mime.getExtension(response.headers.getContentType());
		}
		const bytes = randomBytes(6);
		const fileName = uuid({
			node: bytes
		}) + fileExt;
		const reverseBytes = bytes.reverse();
		return {
			subPath: `${reverseBytes[0].toString(16).padStart(2, '0')}/${reverseBytes[1].toString(16).padStart(2, '0')}`,
			fileName
		};
	}
}

export {plugin}