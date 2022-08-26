package main

import (
	"encoding/json"
	"fmt"
	"time"
	"log"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type SmartContract struct{
	contractapi.Contract
}

type Letter struct {
	BloodID			string			`json:"bloodID"`
	Donor_ID		string			`json:"donor_id"`
	Date			string			`json:"date"`
	Bloodtype		string			`json:"bloodtype"`
	Donationtype	string			`json:"donationtype"`
	Questionnaire	Questionnaire	`json:"questionnaire"`
}

type Questionnaire struct {
	Enable		bool	`json:"enable"`
}

//문진
func (s *SmartContract) HistoryTaking () (Questionnaire, error) {
	questionnaire := Questionnaire {
		Enable	:	true,
	}

	return questionnaire, nil
}

//증서 생성
func (s *SmartContract) CreateLetter (bloodID, donor_ID, bloodtype, donationtype string) (Letter, error) {
	letter := Letter {
		BloodID 		: bloodID,
		Donor_ID		: donor_ID,
		Date			: time.Now().Format("2006-01-02 15:04:05"),
		Bloodtype		: bloodtype,
		Donationtype	: donationtype,
	}

	return letter, nil 
}

//증서 발급
func (s *SmartContract) Donation (ctx contractapi.TransactionContextInterface, donor_ID, bloodID, bloodtype, donationtype string) error {
	letter, _ := s.CreateLetter(bloodID, donor_ID, bloodtype, donationtype);

	questionnaire, _ := s.HistoryTaking();
	if questionnaire.Enable == false {
		fmt.Println("Cannot donate blood.")
		return nil
	}
	letter.Questionnaire = questionnaire

	letterAsByte, err := json.Marshal(letter)
	if err != nil {
		return fmt.Errorf("Marshal failed 1")
	}

	bloodIDAsByte := []byte(letter.BloodID)

	_ = ctx.GetStub().PutState(letter.BloodID, letterAsByte)
	return ctx.GetStub().PutState(donor_ID, bloodIDAsByte)
}

//증서 조회
func (s *SmartContract) QueryLetter (ctx contractapi.TransactionContextInterface, bloodID string) (*Letter, error) {
	letterAsByte, err := ctx.GetStub().GetState(bloodID)
	if err != nil {
		return nil, fmt.Errorf("Fail to read.")
	}
	if letterAsByte == nil {
		return nil, fmt.Errorf("It is empty.")
	}

	letter := new(Letter) 
	err = json.Unmarshal(letterAsByte, letter)
	if err != nil {
		return nil, err
	}

	return letter, nil
}

//내 증서들 조회
func (s *SmartContract) GetLetters (ctx contractapi.TransactionContextInterface, donor_ID string) ([]Letter, error){
	log.Printf("Getting letters. ID: %s", donor_ID)

	resultIterator, err := ctx.GetStub().GetHistoryForKey(donor_ID)
	if err != nil {
		return nil, err
	}
	defer resultIterator.Close()

	var letters []Letter
	for resultIterator.HasNext(){
		
		//ID에 기록된 증서번호 가져오기
		response, err := resultIterator.Next()
		if err != nil {
			return nil, err
		}

		//증서번호로 Letter 내용 가져오기
		var bloodID string
		if len(response.Value) > 0 {
			bloodID = string(response.Value)
		}

		letter, _ := s.QueryLetter(ctx, bloodID)

		letters = append(letters, *letter)
	}

	return letters, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(new(SmartContract))

	if err != nil {
		fmt.Printf("Error occured(BCD chaincode creating): %s", err.Error())
	}

	if err := chaincode.Start(); err != nil {
		fmt.Printf("Error occured(BCD chaincode starting): %s", err.Error())
	}
}