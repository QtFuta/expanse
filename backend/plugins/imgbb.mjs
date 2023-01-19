import axios from 'axios';

let baseUrl = 'https://api.imgbb.com/1/upload';
let plugin = {
	getId() {
		return 'imgbb';
	},
	initialize(){

	},
	receiveItem(item) {
		// Nothing to do here
	},
	async receiveUserItem(user, category, item, config) {
		if (item.type !== 'post' || 
			category !== 'saved' || 
			(item.postType !== 'image' && item.postType !== 'gif' && item.postType !== 'gallery')) {
			return;
		}
		if (item.postType === 'gallery') {
			let keys = Object.keys(item.snooItem.media_metadata);
			for (const key of keys) {
				await this.uploadImage(item.snooItem.media_metadata[key].s.u);
			}
		} else {
			await this.uploadImage(item.snooItem.url);
		}
	},
	getAvailableConfig() {
		
	},
	async uploadImage(url) {
		return await axios.post(`${baseUrl}`, {}, {
			params: {
				key: process.env.IMGBB_API_KEY,
				image: url,
				// name: ''
			}
		});
	}
}

export {plugin}