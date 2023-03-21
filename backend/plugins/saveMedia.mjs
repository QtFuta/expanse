import axios from 'axios';
import URL from 'node:url';
import { v1 as uuid } from 'uuid';
import fs from 'node:fs/promises';

let plugin = {
	getId() {
		return 'saveMedia';
	},
	initialize(){

	},
	receiveItem(item) {
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
				await this.saveContent(item.snooItem.media_metadata[key].s.u);
			}
		} else {
			await this.saveContent(item.snooItem.url, item.snooItem);
		}
	},
	getAvailableConfig() {

	},
	async saveContent(url, post = null) {
		const res = await this.getContent(url, post);
		if (res == null) return;
		url = res.request.res.responseUrl;
		const fileName = this.getFileName(url, res);
		await fs.writeFile(`./plugins_data/media/${fileName}`, res.data);
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