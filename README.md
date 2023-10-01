# expanse

selfhosted multi-user web app for externally storing Reddit items (saved, created, upvoted, downvoted, hidden) to bypass Reddit's 1000-item listing limits

- features::
	- new items auto-sync
	- synced items not affected by Reddit deletion
	- search for items
	- filter by subreddit
	- unsave/delete/unvote/unhide items from Reddit directly on expanse
	- import csv data from [Reddit data request](https://www.reddit.com/settings/data-request)
	- export data as json
- [demo](https://www.youtube.com/watch?v=4pxXM98ewIc)
- requirements::
	- git
	- docker ([managed](https://docs.docker.com/engine/install/linux-postinstall/#manage-docker-as-a-non-root-user)/[rootless](https://docs.docker.com/engine/security/rootless))
	- docker compose
- setup::
	1. clone repo: `git clone https://github.com/jc9108/expanse.git`
	2. cd into repo: `cd ./expanse/`
	3. create environment variables file: `cp ./backend/.env_example ./backend/.env_prod`
	4. fill out the values in the `./backend/.env_prod` file
- usage::
	1. cd into repo
	2. start: `sh ./run.sh prod up` (stop: `sh ./run.sh prod down`)
	3. go to http://localhost:1301 / http://{host ip}:1301
- updating::
	1. cd into repo
	2. update: `sh ./run.sh prod update`
- <details><summary>(optional) systemd service</summary><ol><li>cd into repo</li><li>update repo path in service file: <code>sed -i "s./opt/expanse.$PWD.g" ./expanse.service</code></li><li>allow executing <code>./run.sh</code>: <code>chmod +x ./run.sh</code></li><li>enable and start service: <code>systemctl enable ./expanse.service --now</code></li></ol></details>
