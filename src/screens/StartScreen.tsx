import React, { useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ImageBackground,
} from "react-native";
import { activateKeepAwakeAsync } from "expo-keep-awake";
import * as ScreenOrientation from "expo-screen-orientation";

export default function StartScreen(props: { onStart: () => void }) {
  const { onStart } = props;

  useEffect(() => {
    activateKeepAwakeAsync();
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  return (
    <View style={styles.root}>
      <ImageBackground source={require("../../assets/start-bg.png")} style={{flex: 1, justifyContent: "center", alignItems: "center", width: '100%', height: '100%'}}>
        {/* <Text style={styles.title}>Arma tu ruta</Text> */}
        <Pressable style={styles.btn} onPress={onStart}>
          <Text style={styles.btnText}>Comenzar</Text>
        </Pressable>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: { fontSize: 112, fontWeight: "900", marginBottom: 30 },
  btn: {
    backgroundColor: "#21326b",
    paddingHorizontal: 80,
    paddingVertical: 36,
    borderRadius: 72,
  },
  btnText: { color: "white", fontSize: 104, fontWeight: "900" },
});
