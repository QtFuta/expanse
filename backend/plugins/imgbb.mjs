import axios from 'axios';

let baseUrl = 'https://api.imgbb.com/1/upload';
let plugin = {
	getId() {
		return 'imgbb';
	},
	receiveItem(item) {
		// Nothing to do here
	},
	async receiveUserItem(user, category, item, config) {
		if (item.type !== 'post' || 
			category !== 'saved' || 
			(item.postType !== 'image' && item.postType !== 'gif')) {
			return;
		}
		axios.post(`${baseUrl}`, {}, {
			params: {
				key: process.env.IMGBB_API_KEY,
				image: item.snooItem.url,
				// name: ''
			}
		});
	},
	getAvailableConfig() {
		
	}
}

export {plugin}