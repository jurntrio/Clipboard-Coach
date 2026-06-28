Set shell = CreateObject("WScript.Shell")
Set filesystem = CreateObject("Scripting.FileSystemObject")

scriptDirectory = filesystem.GetParentFolderName(WScript.ScriptFullName)
launcherPath = scriptDirectory & "\Launch Clipboard Coach.cmd"

shell.Run """" & launcherPath & """", 0, False
