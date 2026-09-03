Var DataDir

!macro NSIS_HOOK_PREINSTALL
  ${If} $DataDir == ""
    StrCpy $DataDir "$PROFILE\Documents\NoteData"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ${If} $DataDir == ""
    StrCpy $DataDir "$PROFILE\Documents\NoteData"
  ${EndIf}

  CreateDirectory "$DataDir"
  CreateDirectory "$DataDir\images"
  CreateDirectory "$DataDir\logs"

  FileOpen $0 "$INSTDIR\data-dir.txt" w
  FileWrite $0 "$DataDir"
  FileClose $0

  FileOpen $0 "$DataDir\.note-data-root" w
  FileWrite $0 "${PRODUCTNAME}"
  FileClose $0

  WriteRegStr HKCU "Software\${MANUFACTURER}\${PRODUCTNAME}" "DataDir" $DataDir
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ${If} $DataDir == ""
    ${If} ${FileExists} "$INSTDIR\data-dir.txt"
      FileOpen $0 "$INSTDIR\data-dir.txt" r
      FileRead $0 $DataDir
      FileClose $0
    ${EndIf}
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Delete "$INSTDIR\data-dir.txt"

  ${If} $DeleteAppDataCheckboxState = 1
  ${AndIf} $UpdateMode <> 1
  ${AndIf} $DataDir != ""
  ${AndIf} ${FileExists} "$DataDir\.note-data-root"
    RmDir /r "$DataDir\images"
    RmDir /r "$DataDir\logs"
    Delete "$DataDir\notes.db"
    Delete "$DataDir\notes.db-wal"
    Delete "$DataDir\notes.db-shm"
    Delete "$DataDir\.note-data-root"
    RmDir "$DataDir"
  ${EndIf}
!macroend
