const Discord = require('discord.js')
const config = require('./config.json')
const ytdl = require('ytdl-core') // Youtube downloader.

const client = new Discord.Client()
const queue = new Map();

client.login(config.token)

client.once('ready', () => {
    console.log('I\'m ready.')
})
client.on('reconnecting', () => {
    console.log('I\'m reconnecting.')
})
client.on('disconnect', () => {
    console.log('I\'ve disconnected.')
})

client.on('message', async message => {
    if (message.author.bot) return
    if (!message.content.startsWith(config.prefix)) return

    const serverQueue = queue.get(message.guild.id) // Queue ID

    if (message.content.startsWith(`${config.prefix}play`)) {
        execute(message, serverQueue)
    } else if (message.content.startsWith(`${config.prefix}skip`)) {
        skip(message, serverQueue)
        return
    } else if (message.content.startsWith(`${config.prefix}stop`)) {
        stop(message, serverQueue)
        return
    } else {
        message.channel.send('I have no idea what you are asking me to do.')
    }
})

async function execute (message, serverQueue) {
    const args = message.content.split(" ");

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
        return message.channel.send(
            "You need to be in a voice channel to play music!"
        );
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.channel.send(
            "I'm too weak. (Missing CONNECT and SPEAK permissions)"
        );
    }
    let songInfo
    if ((args[1].includes('youtube.com') || args[1].includes('youtu.be')) && args[1].includes('watch?v=')) {
        songInfo = await ytdl.getInfo(args[1]).catch(error => {
            console.error(error.message)
        })
    }
    if (!songInfo) {
        return message.channel.send('I\'ve failed you. I couldn\'t get any song info. :cry:')
    }
    const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url
    };

    if (!serverQueue) {
        const queueContruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        }

        queue.set(message.guild.id, queueContruct)

        queueContruct.songs.push(song)

        try {
            var connection = await voiceChannel.join()
            queueContruct.connection = connection
            play(message.guild, queueContruct.songs[0])
        } catch (err) {
            console.log(err)
            queue.delete(message.guild.id)
            return message.channel.send(err)
        }
    } else {
        serverQueue.songs.push(song)
        return message.channel.send(`Alright, i've **${song.title}** to the queue.`)
    }
}

function skip (message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to skip the music!"
        );
    if (!serverQueue)
        return message.channel.send("I've nothing to skip.")
    serverQueue.connection.dispatcher.end()
}

function stop (message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );
    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end()
}

function play (guild, song) {
    const serverQueue = queue.get(guild.id)
    if (!song) {
        serverQueue.voiceChannel.leave()
        queue.delete(guild.id)
        return
    }

    const dispatcher = serverQueue.connection
        .play(ytdl(song.url, config.ytdl))
        .on("finish", () => {
            serverQueue.songs.shift()
            play(guild, serverQueue.songs[0])
        })
        .on("error", error => console.error(error))
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5)
    serverQueue.textChannel.send(`I'll play **${song.title}** now.`)
}