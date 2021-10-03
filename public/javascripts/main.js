'use stritct';

const $self = {
  constraints: { audio: false, video: true }
};

requestUserMedia($self.constraints);

async function requestUserMedia(constraints) {
  $self.stream = await navigator.mediaDevices
  .getUserMedia(constraints);
}
