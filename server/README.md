# The world server of Phantom Grid

This small program lets people play free roam **together**. The game itself is a web page; this server is the
"meeting point" that tells every player where the others are.

- **The main world:** everybody who presses *JOIN THE MAIN WORLD* is in the same city (16 players in one world;
  when it is full a second main world opens by itself).
- **Your own world:** *MAKE MY OWN WORLD* gives a code of six letters. Only people who type that code come in.

The server keeps nothing: no accounts, no passwords, no files. It needs Node.js 18 or newer and **nothing else**
(no `npm install` is needed: it only uses what Node.js brings).

## What is shared, and what is not

Shared: where every player is, what they walk, ride or drive, which weapon they hold, shots, chat.
Not shared: the traffic, the people on the sidewalks, the Guard and the money - every player has their own.

## Put it on the internet (free, about ten minutes, works from a phone)

The game page is opened with `https`, so the server needs an address that starts with `wss://`. A host gives that
for free. With **Render** (render.com):

1. Make a free account on render.com and sign in with GitHub.
2. **New > Web Service**, choose this repository.
3. Fill in:
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
4. Press **Create Web Service** and wait until it says *Live*. Render shows an address like
   `https://phantom-grid-world.onrender.com`. Open it in the browser: it must say
   `Phantom Grid world server - players online: 0`.
5. In the game: **ONLINE > SERVER ADDRESS**, type the same address with `wss://` in front instead of `https://`:
   `wss://phantom-grid-world.onrender.com`. The phone remembers it.

(The file `render.yaml` in the top folder of this project describes the same settings; Render can read it with
**New > Blueprint**.)

To give **every** player the address without typing: put it into `src/config.js`:

```js
online: { server: 'wss://phantom-grid-world.onrender.com' },
```

### Good to know about a free host

- A free server **sleeps** when nobody has played for about 15 minutes and needs **about a minute** to wake up.
  The game waits for it and says so ("The world server was asleep ...").
- A free host may restart the server at any time; then every player is put out of the world and joins again.
  The codes of own worlds are forgotten (they only live as long as somebody is in the world).
- Any other host that runs a Node.js program and allows WebSockets works the same way: the start command is
  `node server.js`, the port comes from the `PORT` setting of the host.

## Run it at home (for a test)

```
cd server
node server.js
```

It listens on port 8080: `ws://THE-COMPUTER'S-ADDRESS:8080`. This plain `ws://` address only works when the game
page itself was opened with plain `http://` (a local copy of the game) - a browser does not let an `https` page
talk to a `ws://` server.

## Settings (all optional)

| Setting       | Default | What it does                          |
| ------------- | ------- | ------------------------------------- |
| `PORT`        | 8080    | the port to listen on                 |
| `MAX_PLAYERS` | 16      | players in one world                  |
| `MAX_TOTAL`   | 400     | connections on the whole server       |

## The messages

They are written at the top of `server.js`. The server trusts nothing it gets: numbers are cut to sensible
ranges, names and chat lines are cleaned and shortened, a player may send twelve events a second, a message
longer than 2 kB closes the connection.
