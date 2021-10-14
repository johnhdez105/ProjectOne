'use strict';

const $self = {
  rtcConfig: null,
  constraints: { audio: false, video: true },
  isPolite: false,
  isMakingOffer: false,
  isIgnoringOffer: false,
  isSettingRemoteAnswerPending: false
};

const $peer = {
  connection: new RTCPeerConnection($self.rtcConfig)
};

requestUserMedia($self.constraints);

async function requestUserMedia(constraints) {
  $self.stream = await navigator.mediaDevices.getUserMedia(constraints);
  displayStream('#self', $self.stream);
}

const namespace = prepareNamespace(window.location.hash, true);

const sc = io(`/${namespace}`, { autoConnect: false });

registerScEvents();

const button = document.querySelector('#call-button');

button.addEventListener('click', handleButton);

function displayStream(selector, stream) {
  const video = document.querySelector(selector);
  video.srcObject = stream;
}

function handleButton(e) {
  const button = e.target;
  if (button.className === 'join') {
    button.className = 'leave';
    button.innerText = 'Leave Call';
    joinCall();
  } else {
    button.className = 'join';
    button.innerText = 'Join Call';
    leaveCall();
  }
}

function handleChatForm(e) {
  e.preventDefault();
  console.log('The chat form was submitted!');
  const log = document.querySelector('#chat-log');
  const form = e.target;
  const input = form.querySelector('#chat-input');
  const message = input.value;

  const li = document.createElement('li');
  li.innerText = message;
  li.className = 'self';
  log.appendChild(li);

  // TODO: send message over data channel

  console.log('The chat form was submitted. Message:', message);
  input.value = '';
}

function joinCall() {
  sc.open();
  registerRtcEvents($peer);
  establishCallFeatures($peer);
}
function leaveCall() {
  $peer.connection.close();
  $peer.connection = new RTCPeerConnection($self.rtcConfig);
  displayStream('#peer', null);
  sc.close();
}

function establishCallFeatures(peer) {
  peer.connection
    .addTrack($self.stream.getTracks()[0],
      $self.stream);
}

function registerRtcEvents(peer) {
  peer.connection
    .onnegotiationneeded = handleRtcNegotiation;
  peer.connection
    .onicecandidate = handleIceCandidate;
  peer.connection
    .ontrack = handleRtcTrack;
    peer.connection
  .ondatachannel = handleRtcDataChannel;
}

async function handleRtcNegotiation() {
  console.log('RTC negotiation needed...');

  $self.isMakingOffer = true;
  await $peer.connection.setLocalDescription();
  sc.emit('signal', { description:
    $peer.connection.localDescription });
  $self.isMakingOffer = false;
}
function handleIceCandidate({ candidate }) {
  sc.emit('signal', { candidate:
    candidate });
}
function handleRtcTrack({ track, streams: [stream] }) {
  displayStream('#peer', stream);
}

function handleRtcDataChannel({ channel }) {
  console.log('Heard a data channel event', channel);
  $peer.testChannel = channel;
  console.log('The label is:', $peer.testChannel.label);
}

function registerScEvents () {
  sc.on('connect', handleScConnect);
  sc.on('connected peer', handleScConnectedPeer);
  sc.on('signal', handleScSignal);
  sc.on('disconnected peer', handleScDisconnectedPeer);
}
function handleScConnect() {
  console.log('Connected to signaling channel');
}
function handleScConnectedPeer() {
  console.log('Heard connected peer event');
  $self.isPolite = true;
}
function handleScDisconnectedPeer(){
  console.log('Heard disconnected peer event');
  displayStream('#peer', null);
  $peer.connection.close();
  $peer.connection = new RTCPeerConnection($self.rtcConfig);
  registerRtcEvents($peer);
  establishCallFeatures($peer);
}
async function handleScSignal({ description, candidate }) {
  console.log('Heard signal event!');
  if (description) {
    console.log('Received SDP Signal:', description);
    const readyForOffer =
    !$self.isMakingOffer &&
    ($peer.connection.signalingState === 'stable'
      || $self.isSettingRemoteAnswerPending);

const offerCollision = description.type === 'offer' && !readyForOffer;

$self.isIgnoringOffer = !$self.isPolite && offerCollision;

if ($self.isIgnoringOffer) {
  return;
}
$self.isSettingRemoteAnswerPending = description.type === 'answer';
await $peer.connection.setRemoteDescription(description);
$self.isSettingRemoteAnswerPending = false;

if (description.type === 'offer') {
  await $peer.connection.setLocalDescription();
  sc.emit('signal',
    { description:
      $peer.connection.localDescription });
    }
  } else if (candidate) {
    console.log('Received ICE candidate:', candidate);
    try {
      await $peer.connection.addIceCandidate(candidate);
    } catch(e) {
      if (!$self.isIgnoringOffer) {
        console.error('Cannot add ICE candidate for peer', e);
      }
    }
  }
}

function prepareNamespace(hash, set_location) {
  let ns = hash.replace(/^#/, '');
  if (/^[0-9]{6}$/.test(ns)) {
    console.log('Checked existing namespace', ns);
    return ns;
  }
  ns = Math.random().toString().substring(2, 8);
  console.log('Created new namespace', ns);
  if (set_location) window.location.hash = ns;
  return ns;
}
