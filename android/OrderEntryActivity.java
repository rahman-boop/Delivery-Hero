package com.example.deliveryhero;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

public class OrderEntryActivity extends AppCompatActivity {
    EditText etName, etPhone, etAddress, etDetails, etCharge;
    Button btnSave, btnWhatsApp;
    DatabaseHelper dbHelper;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_order_entry);

        etName = findViewById(R.id.etName);
        etPhone = findViewById(R.id.etPhone);
        etAddress = findViewById(R.id.etAddress);
        etDetails = findViewById(R.id.etDetails);
        etCharge = findViewById(R.id.etCharge);
        btnSave = findViewById(R.id.btnSave);
        btnWhatsApp = findViewById(R.id.btnWhatsApp);
        dbHelper = new DatabaseHelper(this);

        btnWhatsApp.setOnClickListener(v -> shareOnWhatsApp());
        btnSave.setOnClickListener(v -> saveToDatabase());
    }

    private void shareOnWhatsApp() {
        String name = etName.getText().toString();
        String phone = etPhone.getText().toString();
        String address = etAddress.getText().toString();
        String details = etDetails.getText().toString();
        String charge = etCharge.getText().toString();

        String message = "*নতুন অর্ডার*\n\nকাস্টমার: " + name + "\nফোন: " + phone + "\nঠিকানা: " + address + "\nখাবার: " + details + "\nচার্জ: ৳" + charge;
        
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setData(Uri.parse("https://api.whatsapp.com/send?text=" + message));
        startActivity(intent);
    }

    private void saveToDatabase() {
        String name = etName.getText().toString();
        String phone = etPhone.getText().toString();
        String address = etAddress.getText().toString();
        String details = etDetails.getText().toString();
        double charge = Double.parseDouble(etCharge.getText().toString());

        long id = dbHelper.insertOrder(name, phone, address, details, charge);
        if (id != -1) {
            Toast.makeText(this, "Order Saved Successfully", Toast.LENGTH_SHORT).show();
            finish();
        }
    }
}
