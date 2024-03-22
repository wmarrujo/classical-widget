import {run, css} from "uebersicht"

////////////////////////////////////////////////////////////////////////////////
// CONFIGURATION
////////////////////////////////////////////////////////////////////////////////

export const refreshFrequency = 1000 * 5 // refresh every 5 seconds

////////////////////////////////////////////////////////////////////////////////
// RENDERING
////////////////////////////////////////////////////////////////////////////////

export const className = `
	bottom: 15%;
	right: calc(50% - 500px / 2);
	width: 500px;
	font-family: -apple-system;
	color: white;
`

export const render = (data) => {
	return (
		<div>
			{/* renderPreviousTrack */}
			{ data.active ? renderTrack(data) : "" }
		</div>
	)
}

const trackStyle = css`
	display: grid;
	grid-template-columns: 1fr 1fr 1fr;
	grid-template-areas:
		"title title title"
		"composer composer composer"
		"progress progress progress"
		"soloistsIcon ensembleIcon conductorIcon"
		"soloists ensemble conductor";
	grid-gap: 1em;
`

const progressStyle = css`
	grid-area: progress;
`

const titleStyle = css`
	display: block;
	grid-area: title;
	font-size: 1.5em;
	text-align: center;
`

const composerStyle = css`
	display: block;
	grid-area: composer;
	text-align: center;
`

const iconStyle = css`
	text-align: center;
	font-size: 1.5em;
`

const soloistsIconStyle = css`grid-area: soloistsIcon;`
const ensembleIconStyle = css`grid-area: ensembleIcon;`
const conductorIconStyle = css`grid-area: conductorIcon; font-size: 2.3em; line-height: 0.5;`

const detailStyle = css`
	text-align: center;
`

const soloistsStyle = css`grid-area: soloists;`
const ensembleStyle = css`grid-area: ensemble;`
const conductorStyle = css`grid-area: conductor;`

// Bar Styles

const barBackgroundStyle = css`
	width: 100%;
	height: 0.3em;
	background-color: #FFFFFF88;
`

const barForegroundStyle = css`
	height: 100%;
	background-color: white;
`

const barPausedBackgroundStyle = css`
	background-color: #FF000088;
`

const barPausedForegroundStyle = css`
	background-color: #FF0000;
`

const barIndeterminateBackgroundStyle = css`
	background-color: #FFFFFF88;
`

const barIndeterminateForegroundStyle = css`
	background: repeating-linear-gradient(
		60deg,
		#FFFFFFFF,
		#FFFFFFFF 1.2em,
		#FFFFFF00 1.2em,
		#FFFFFF00 2em
	);
`

function renderTrack(data) {
	const indeterminate = data.duration <= 0 // if the duration is 0
	const percentage = indeterminate ? 0 : data.position / data.duration
	return (
		<div className={trackStyle}>
			<span className={titleStyle}>{data.name}</span>
			<span className={composerStyle}>{data.composer}</span>
			
			<div className={progressStyle}>
				<div className={`${barBackgroundStyle} ${!data.playing ? barPausedBackgroundStyle : (indeterminate ? barIndeterminateBackgroundStyle : "")}`}>
					<div className={`${barForegroundStyle} ${!data.playing ? barPausedForegroundStyle : ""} ${indeterminate ? barIndeterminateForegroundStyle : ""} ${css({width: `${Math.max(0, Math.min(1, percentage)) * 100}%`})}`}></div>
				</div>
			</div>
			
			<span className={`${soloistsIconStyle} ${iconStyle}`}>★</span>
			<div className={`${soloistsStyle} ${detailStyle}`}>
				{data.soloists?.map((soloist, index) => <span key={index}>{soloist}</span>)}
			</div>
			
			<span className={`${ensembleIconStyle} ${iconStyle}`}>♫</span>
			<div className={`${ensembleStyle} ${detailStyle}`}>
				<span>{data.ensemble}</span>
			</div>
			
			<span className={`${conductorIconStyle} ${iconStyle}`}>♚</span>
			<div className={`${conductorStyle} ${detailStyle}`}>
				<span>{data.conductor}</span>
			</div>
		</div>
	)
}

// TODO: enable saving of history as we go along

const previousTrackStyle = css`
	display: block;
	text-align: center;
	color: #FFFFFF88;
	width: 100%;
	margin-bottom: 2em;
`

function renderPreviousTrack(track, index) {
	return (
		<div key={index} className={previousTrackStyle}>
			<div>{track.title}</div>
			<div>{track.composer}</div>
		</div>
	)
}

////////////////////////////////////////////////////////////////////////////////
// UPDATING
////////////////////////////////////////////////////////////////////////////////

// STATE

export const initialState = {active: false}

export const command = (dispatch) => {
	getCurrentTrack()
		.then(result => dispatch({type: "GET STATUS", output: result}))
		.catch(error => dispatch({type: "GET STATUS", error: error}))
}

export const updateState = (event, previous) => {
	return event.error ? initialState : event.output || previous
}

// DATA GATHERING

const currentlyPlayingScript = `
output = {active: false, playing: false, name: null, url: null, position: null, duration: null, composer: null, soloists: [], ensemble: null, conductor: null}

if (Application('Music').running()) {
	try {
		output.active = true
		const music = Application('Music')
		output.playing = music.playerState() === 'playing'
		output.name = music.currentTrack.name()
		try { output.url = music.currentTrack.address() } catch {}
		output.position = music.playerPosition()
		output.duration = music.currentTrack.duration()
		output.composer = music.currentTrack.composer()
		output.ensemble = music.currentTrack.artist()
	} catch {}
}

JSON.stringify(output)
`

async function getCurrentTrack() {
	// get the Apple Music status
	const status = JSON.parse(await run(`osascript -l JavaScript -e "${currentlyPlayingScript}"`))
	// get supplemental status
	if (status.url == "https://cms.stream.publicradio.org/cms.aac") { // if it's Classical MPR's stream
		const tracks = (await fetch("https://nowplaying.publicradio.org/classical-mpr/playlist").then(res => res.json())).data.songs
		// TODO: only fetch when we know the song is done, waiting for the next song, not every 5 seconds
		status.name = tracks[0].title
		status.composer = tracks[0].composer
		status.ensemble = tracks[0].orch_ensemble
		status.conductor = tracks[0].conductor
		status.soloists = [tracks[0].soloist_1, tracks[1].soloist_2, tracks[1].soloist_3, tracks[1].soloist_4, tracks[1].soloist_5, tracks[1].soloist_6]
		status.duration = parseDurationString(tracks[0].duration)
		status.position = ((new Date()).getTime() - (new Date(tracks[0].played_at)).getTime()) / 1000
	}
	return status
}

////////////////////////////////////////////////////////////////////////////////
// UTILITIES
////////////////////////////////////////////////////////////////////////////////

/** parses a duration string, returns as seconds */
function parseDurationString(duration) {
	const parsed = /(?:(?<hours>\d+):)?(?<minutes>\d?\d):(?<seconds>\d\d)/.exec(duration)
	return (Number(parsed[1]) || 0) * 60 * 60 + Number(parsed[2]) * 60 + Number(parsed[3])
}
