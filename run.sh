#!/bin/sh

if [ "$1" != "dev" ] && [ "$1" != "prod" ]; then
	echo "Invalid environment. Valid options: 'dev' and 'prod'"
	return
fi

export $(cat backend/.env_$1 | sed -E -e 's/#.*//' -e 's/="/=/' -e 's/(" *$|" *#)//' -e '/^$/d' | xargs -d '\n')
COMPOSER_FILE=./compose.%env%%db_type%.yaml
COMPOSER_FILE=$(echo $COMPOSER_FILE | sed "s/%env%/$1/")
[ $DB_DRIVER = 'sqlite' ] && DB_TYPE=".lite" || DB_TYPE=""
COMPOSER_FILE=$(echo $COMPOSER_FILE | sed "s/%db_type%/$DB_TYPE/")

if [ "$1" = "dev" ]; then
	if [ "$2" = "audit" ]; then
		(cd ./backend/ && npm audit)
		cd ./frontend/ && npm audit
		return
	elif [ "$2" = "outdated" ]; then
		(cd ./backend/ && npm outdated)
		cd ./frontend/ && npm outdated
		return
	elif [ "$2" = "build" ]; then
		(cd ./backend/ && npm install)
		(cd ./frontend/ && npm install && npm run build)
		sudo PWD=${PWD} docker compose -f $COMPOSER_FILE build
		return
	elif [ "$2" = "up" ]; then
		sudo PWD=${PWD} docker compose -f $COMPOSER_FILE up --no-build
		return
	fi
elif [ "$1" = "prod" ]; then
	if [ "$2" = "up" ]; then
		if [ "$3" = "--no-d" ]; then
			sudo PWD=${PWD} docker compose -f $COMPOSER_FILE up
			return
		fi
		sudo PWD=${PWD} docker compose -f $COMPOSER_FILE up -d
		return
	elif [ "$2" = "down" ]; then
		sudo PWD=${PWD} docker compose -f $COMPOSER_FILE down
		return
	elif [ "$2" = "update" ]; then
		sh ./run.sh prod down
		git pull
		sudo PWD=${PWD} docker compose -f $COMPOSER_FILE pull
		sh ./run.sh prod up
		return
	fi
fi
