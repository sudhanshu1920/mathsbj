package android.content;
public interface DialogInterface {
    interface OnClickListener { void onClick(DialogInterface dialog, int which); }
    interface OnMultiChoiceClickListener { void onClick(DialogInterface dialog, int which, boolean isChecked); }
}