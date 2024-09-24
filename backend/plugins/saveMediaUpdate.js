#!/bin/node

import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
import path from 'path';

const dataPath = '../plugins_data/media';

const client = new Database(`${dataPath}/items.db`);

const items = client.prepare('SELECT * FROM item').all();

const regex = new RegExp('\/[\\da-f]{2}\/[\\da-f]{2}\/?$', 'i');

items.forEach((value) => {
	client.transaction(async () => {
		const fileName = path.basename(value.file);
		const filePath = path.dirname(value.file);

		if (regex.test(filePath)) {
			console.log(`Skip: ${value.id} - ${value.file}`);
			return;
		}

		const subDirs = `${fileName.substring(6, 8)}/${fileName.substring(4, 6)}`;
		const newPath = `${filePath}/${subDirs}`;
		await fs.mkdir('../' + newPath, {recursive: true});
		const newFile = `${newPath}/${fileName}`;

		client.prepare('UPDATE item SET file=? where id=?').run(newFile, value.id);
		
		fs.rename('../' + value.file, '../' + newFile);
	})();
});