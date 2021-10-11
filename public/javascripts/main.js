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
  const video = document.querySelector('#self');
  $self.stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = $self.stream;
}

const namespace = prepareNamespace(window.location.hash, true);

const sc = io(`/${namespace}`, { autoConnect: false });

const button = document.querySelector('#call-button');

button.addEventListener('click', joinCall);

function joinCall() {
  sc.open();
  registerRtcEvents($peer);
  establishCallFeatures($peer);
}
function leaveCall() {
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
function handleRtcTrack() {
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
