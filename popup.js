'use strict'

let tid = 0
const frameMap = new Map()
const elementsList = document.getElementById('elements-list')
const elementsTpl = document.getElementById('elements-tpl')

function applySettings (fid, elid, newSettings) {
	return browser.tabs.executeScript(tid, { frameId: fid, code: `(function () {
		const el = document.querySelector('[data-x-soundfixer-id="${elid}"]')
		if (!el.xSoundFixerContext) {
			el.xSoundFixerContext = new AudioContext()
			el.xSoundFixerGain = el.xSoundFixerContext.createGain()
			el.xSoundFixerPan = el.xSoundFixerContext.createStereoPanner()
			el.xSoundFixerSource = el.xSoundFixerContext.createMediaElementSource(el)
			el.xSoundFixerSource.connect(el.xSoundFixerGain)
			el.xSoundFixerGain.connect(el.xSoundFixerPan)
			el.xSoundFixerPan.connect(el.xSoundFixerContext.destination)
		}
		const newSettings = ${JSON.stringify(newSettings)}
		if (newSettings.gain) {
			el.xSoundFixerGain.gain.value = newSettings.gain
		}
		if (newSettings.pan) {
			el.xSoundFixerPan.pan.value = newSettings.pan
		}
		el.xSoundFixerSettings = {
			gain: el.xSoundFixerGain.gain.value,
			pan: el.xSoundFixerPan.pan.value
		}
	})()` })
}

browser.tabs.query({ currentWindow: true, active: true }).then(tabs => {
	tid = tabs[0].id
	return browser.webNavigation.getAllFrames({ tabId: tid }).then(frames =>
		Promise.all(frames.map(frame => {
			const fid = frame.frameId
			return browser.tabs.executeScript(tid, { frameId: fid, code: `(function () {
				const result = new Map()
				for (const el of document.querySelectorAll('video, audio')) {
					if (!el.hasAttribute('data-x-soundfixer-id')) {
						el.setAttribute('data-x-soundfixer-id',
							Math.random().toString(36).substr(2, 10))
					}
					result.set(el.getAttribute('data-x-soundfixer-id'), {
						type: el.tagName.toLowerCase(),
						settings: el.xSoundFixerSettings
					})
				}
				return result
			})()` }).then(result => frameMap.set(fid, result[0]))
			.catch(err => console.error(`tab ${tid} frame ${fid}`, err))
		}))
	)
}).then(_ => {
	elementsList.innerHTML = ''
	for (const [fid, els] of frameMap) {
		for (const [elid, el] of els) {
			const settings = el.settings || {}
			const node = document.importNode(elementsTpl.content, true)
			node.querySelector('.element-label').innerHTML = `${el.type} in frame ${fid}`
			const gain = node.querySelector('.element-gain')
			gain.value = settings.gain || 1
			gain.addEventListener('change', _ => {
				applySettings(fid, elid, { gain: gain.value })
				gain.title = '' + gain.value
			})
			const pan = node.querySelector('.element-pan')
			pan.value = settings.pan || 0
			pan.addEventListener('change', _ => {
				applySettings(fid, elid, { pan: pan.value })
				pan.title = '' + pan.value
			})
			elementsList.appendChild(node)
		}
	}
	if (elementsList.innerHTML === '') {
		elementsList.innerHTML = '<li>No audio/video found in the current tab. Note that some websites do not work because of security restrictions.</li>'
	}
})
