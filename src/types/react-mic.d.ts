declare module "react-mic" {
  import React from "react";

  export interface ReactMicProps {
    record: boolean;
    className?: string;
    onStop?: (recordedBlob: any) => void;
    onData?: (recordedBlob: any) => void;
    mimeType?: string;
    strokeColor?: string;
    backgroundColor?: string;
    visualSetting?: string;
  }

  export const ReactMic: React.FC<ReactMicProps>;
}
